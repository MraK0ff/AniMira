"""Core DSL interpreter for AniLabX JSON parser configs."""
from __future__ import annotations
import html
import logging
import re
from typing import Any
from app.variable_resolver import VariableResolver
from app.http_client import HttpClient
from app.config_loader import ParserConfig
from app import content_parsers

logger = logging.getLogger(__name__)


def _unescape(text: str) -> str:
    try:
        return text.encode('utf-8').decode('unicode_escape')
    except Exception:
        return text


def apply_single_replace(value: str, rep: dict, resolver: VariableResolver, **kw) -> str:
    if not isinstance(rep, dict):
        return value
    if rep.get("unescape_unicode"):
        value = _unescape(value)
    match_pat = rep.get("match")
    replacement = rep.get("text")
    if match_pat is not None and replacement is not None:
        resolved_match = resolver.resolve(match_pat, **kw)
        resolved_text = resolver.resolve(replacement, **kw)
        match_num = rep.get("match_number")
        group_num = rep.get("group")
        if match_num or group_num:
            mn = int(match_num) if match_num else 1
            gn = int(group_num) if group_num else 0
            matches = list(re.finditer(resolved_match, value))
            if len(matches) >= mn:
                m = matches[mn - 1]
                try:
                    value = m.group(gn)
                except (IndexError, re.error):
                    pass
            else:
                value = ""
        else:
            try:
                # Convert $1, $2, etc. backreferences to \1, \2 for Python re.sub
                python_text = re.sub(r'\$(\d+)', r'\\\1', resolved_text)
                value = re.sub(resolved_match, python_text, value)
            except re.error:
                value = value.replace(resolved_match, resolved_text)
    prefix = rep.get("prefix")
    if prefix:
        value = resolver.resolve(prefix, **kw) + value
    sufix = rep.get("sufix")
    if sufix:
        value = value + resolver.resolve(sufix, **kw)
    return value


def apply_replace(value: str, replace_cfg, resolver: VariableResolver, **kw) -> str:
    if replace_cfg is None:
        return value
    if isinstance(replace_cfg, list):
        for r in replace_cfg:
            value = apply_single_replace(value, r, resolver, **kw)
    elif isinstance(replace_cfg, dict):
        value = apply_single_replace(value, replace_cfg, resolver, **kw)
    return value


def extract_value(block: str, field_cfg, resolver: VariableResolver, **kw) -> str | None:
    if isinstance(field_cfg, str):
        return field_cfg
    if not isinstance(field_cfg, dict):
        return None
    text = block
    skip = field_cfg.get("skip")
    if skip:
        idx = text.find(skip)
        if idx == -1:
            return None
        text = text[idx + len(skip):]
    after = field_cfg.get("after")
    if after:
        idx = text.find(after)
        if idx == -1:
            return None
        text = text[idx + len(after):]
    t1 = field_cfg.get("token1")
    t2 = field_cfg.get("token2")
    if not t1 or not t2:
        return None
    idx1 = text.find(t1)
    if idx1 == -1:
        return None
    start = idx1 + len(t1)
    idx2 = text.find(t2, start)
    if idx2 == -1:
        return None
    value = text[start:idx2].strip()
    value = apply_replace(value, field_cfg.get("replace"), resolver, **kw)
    pfx = field_cfg.get("prefix")
    if pfx and "replace" not in field_cfg:
        value = resolver.resolve(pfx, **kw) + value
    sfx = field_cfg.get("sufix")
    if sfx and "replace" not in field_cfg:
        value = value + resolver.resolve(sfx, **kw)
    return value


def extract_split(block: str, field_cfg, resolver: VariableResolver, **kw) -> list[str]:
    if not isinstance(field_cfg, dict) or "split" not in field_cfg:
        return []
    raw = extract_value(block, field_cfg, resolver, **kw)
    if not raw:
        return []
    return [s.strip() for s in raw.split(field_cfg["split"]) if s.strip()]


def check_skip_anime(block: str, link: str, skip_cfg: dict) -> bool:
    if not skip_cfg:
        return False
    contains = skip_cfg.get("contains")
    if contains:
        start_m = contains.get("start", "")
        end_m = contains.get("end", "")
        si = block.find(start_m) if start_m else 0
        ei = block.find(end_m, si) if end_m else len(block)
        if si != -1 and ei != -1:
            region = block[si:ei]
            for v in contains.get("values", []):
                if v in region:
                    return True
    link_contains = skip_cfg.get("link_contains", [])
    for lc in link_contains:
        if lc in link:
            return True
    return False


def resolve_status(html_text: str, status_cfg) -> str | None:
    if not isinstance(status_cfg, dict):
        return None
    default = status_cfg.get("default")
    for key, val in status_cfg.items():
        if key == "default":
            continue
        if isinstance(val, str) and val in html_text:
            return key
        if isinstance(val, dict):
            start = val.get("start", "")
            value = val.get("value", "")
            end = val.get("end", "")
            si = html_text.find(start) if start else 0
            ei = html_text.find(end, si) if end else len(html_text)
            if si != -1 and ei != -1 and value in html_text[si:ei]:
                return key
    return default


def resolve_content_type(html_text: str, ct_cfg) -> str | None:
    if not isinstance(ct_cfg, dict):
        return None
    return resolve_status(html_text, ct_cfg)


def get_next_delimiter(next_cfg) -> tuple[str | None, re.Pattern | None]:
    if isinstance(next_cfg, str):
        return next_cfg, None
    if isinstance(next_cfg, dict):
        vr = next_cfg.get("value_regexp")
        if vr:
            return None, re.compile(vr)
    return None, None


def split_blocks(text: str, next_str: str | None, next_re: re.Pattern | None, end_marker: str | None) -> list[str]:
    blocks = []
    pos = 0
    while pos < len(text):
        if end_marker and text.find(end_marker, pos) != -1 and (next_str is None or text.find(end_marker, pos) <= text.find(next_str, pos) if text.find(next_str, pos) != -1 else True):
            em_pos = text.find(end_marker, pos)
            if pos < em_pos:
                blocks.append(text[pos:em_pos])
            break
        if next_str:
            idx = text.find(next_str, pos)
            if idx == -1:
                blocks.append(text[pos:])
                break
            if pos < idx:
                blocks.append(text[pos:idx])
            pos = idx + len(next_str)
        elif next_re:
            m = next_re.search(text, pos)
            if not m:
                blocks.append(text[pos:])
                break
            if pos < m.start():
                blocks.append(text[pos:m.start()])
            pos = m.end()
        else:
            blocks.append(text[pos:])
            break
    return blocks


class ParserEngine:
    def __init__(self, config: ParserConfig, http: HttpClient):
        self.config = config
        self.http = http
        self.resolver = VariableResolver(config.data)

    async def _fetch(self, url: str, *, method: str = "GET", headers: dict | None = None,
                     form_data: dict | None = None, encoding: str | None = None) -> str:
        merged = {}
        if self.config.user_agent:
            merged["User-Agent"] = self.config.user_agent
        if headers:
            merged.update(headers)
        
        # Use provided encoding or fallback to global config encoding
        target_encoding = encoding or self.config.encoding
        
        if method == "POST":
            return await self.http.post(url, headers=merged, form_data=form_data,
                                        encoding=target_encoding, user_agent=self.config.user_agent)
        return await self.http.get(url, headers=merged, encoding=target_encoding,
                                   user_agent=self.config.user_agent)

    def _get_json_value(self, data: dict, path: str) -> Any:
        """Extract value from nested dict using dot-notation path like 'name.main'."""
        parts = path.split(".")
        current = data
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None
        return current

    def _parse_add_anime_json(self, json_data: dict, add_cfg: dict, **kw) -> list[dict]:
        """Parse anime list from JSON API response."""
        results = []
        iterator = add_cfg.get("iterator", {})
        path = iterator.get("path", "")
        
        # Get the array of items from the JSON path
        items = json_data
        if path:
            items = self._get_json_value(json_data, path)
        
        if not isinstance(items, list):
            return results
        
        for item_data in items:
            if not isinstance(item_data, dict):
                continue
            
            # Extract link
            link_cfg = iterator.get("link", {})
            link = None
            if link_cfg:
                link_val = self._get_json_value(item_data, link_cfg.get("from", ""))
                if link_val:
                    link = link_val
                    # Apply prefix/suffix replacements
                    replace_cfg = link_cfg.get("replace", {})
                    if replace_cfg.get("prefix"):
                        link = self.resolver.resolve(replace_cfg["prefix"], **kw) + link
                    if replace_cfg.get("suffix"):
                        link = link + replace_cfg["suffix"]
            
            if not link:
                continue
            
            result = {"url": link}
            
            # Extract other fields
            field_map = {
                "title": "title",
                "additional_title": "additional_title",
                "cover": "cover",
                "episodes_aired": "episodes_aired",
                "uniq": "uniq"
            }
            
            for cfg_key, result_key in field_map.items():
                field_cfg = iterator.get(cfg_key)
                if field_cfg:
                    if isinstance(field_cfg, dict) and "from" in field_cfg:
                        val = self._get_json_value(item_data, field_cfg["from"])
                        if val:
                            # Handle replace config
                            replace_cfg = field_cfg.get("replace", {})
                            if replace_cfg.get("prefix"):
                                val = self.resolver.resolve(replace_cfg["prefix"], **kw) + str(val)
                            if replace_cfg.get("suffix"):
                                val = str(val) + replace_cfg["suffix"]
                            if replace_cfg.get("unescape_unicode"):
                                val = _unescape(str(val))
                            result[result_key] = val
                    elif isinstance(field_cfg, str):
                        result[result_key] = field_cfg
            
            if "title" not in result:
                result["title"] = link
            
            results.append(result)
        
        return results

    def _parse_add_anime(self, html_text: str, add_cfg: dict, **kw) -> list[dict]:
        results = []
        text = html_text
        start = add_cfg.get("start")
        if start:
            idx = text.find(start)
            if idx == -1:
                return []
            text = text[idx:]
        hard_end = None
        for k, v in add_cfg.items():
            if k == "!end" and isinstance(v, str):
                he = text.find(v)
                if he != -1:
                    text = text[:he]
        end_marker = add_cfg.get("end")
        next_cfg = add_cfg.get("next")
        if not next_cfg:
            return []
        next_str, next_re = get_next_delimiter(next_cfg)
        blocks = split_blocks(text, next_str, next_re, end_marker)
        skip_cfg = add_cfg.get("skip_anime")
        rk = dict(kw)
        for block in blocks:
            link = extract_value(block, add_cfg.get("link", {}), self.resolver, **rk)
            if not link:
                continue
            if skip_cfg and check_skip_anime(block, link, skip_cfg):
                continue
            item = {"url": link}
            for field in ("title", "additional_title", "cover", "episodes_aired",
                          "next_episode_at", "season", "uniq", "alt_title"):
                cfg = add_cfg.get(field)
                if cfg and not (isinstance(field, str) and field.startswith("!")):
                    val = extract_value(block, cfg, self.resolver, **rk)
                    if val:
                        item[field] = val
            if "title" not in item:
                item["title"] = link
            results.append(item)
        return results

    async def parse_search(self, query: str, page: int = 1) -> list[dict]:
        section = self.config.get_section("anime_search_complete")
        if not section:
            return []
        rk = {"page": page, "query": query}
        search_link = self.resolver.resolve(section.get("search_link", ""), **rk)
        method = section.get("query_type", "GET").upper()
        headers = section.get("add_anime", {}).get("headers")
        form_data = None
        if section.get("form_data"):
            form_data = {k: self.resolver.resolve(v, **rk) for k, v in section["form_data"].items()}
        encoding = section.get("encoding")
        html_text = await self._fetch(search_link, method=method, headers=headers, form_data=form_data, encoding=encoding)
        add_cfg = section.get("add_anime", {})
        return self._parse_add_anime(html_text, add_cfg, **rk)

    async def parse_list(self, page: int = 1, category: str | None = None) -> list[dict]:
        section = self.config.get_section("anime_list_complete")
        if not section:
            return []
        rk = {"page": page}
        iterator = section.get("iterator")
        add_cfg = section.get("add_anime", {})
        headers = add_cfg.get("headers")
        if iterator is None:
            return []
        iters = iterator if isinstance(iterator, list) else [iterator]
        target_iter = None
        if category:
            for it in iters:
                cat = it.get("category", {})
                if cat.get("tag") == category or cat.get("name") == category:
                    target_iter = it
                    break
        if not target_iter:
            target_iter = iters[0]
        url = ""
        append = target_iter.get("append_nums")
        method = target_iter.get("method", "GET").upper()
        if page == 1 and target_iter.get("first_page_url"):
            url = self.resolver.resolve(target_iter["first_page_url"], **rk)
        elif target_iter.get("base_url"):
            base = self.resolver.resolve(target_iter["base_url"], **rk)
            if append and method != "POST":
                actual_page = append.get("from", 1) + (page - 1) * append.get("step", 1)
                suffix = append.get("sufix", "")
                url = f"{base}{actual_page}{suffix}"
            else:
                url = base
        form_data = None
        if target_iter.get("form_data"):
            form_data = {k: self.resolver.resolve(v, **rk) for k, v in target_iter["form_data"].items()}
        encoding = section.get("encoding")
        
        # Check if this is JSON API parsing
        is_json = section.get("json_content", False) or add_cfg.get("json_content", False)
        
        response_text = await self._fetch(url, method=method, headers=headers, form_data=form_data, encoding=encoding)
        
        if is_json:
            try:
                import json
                json_data = json.loads(response_text)
                return self._parse_add_anime_json(json_data, add_cfg, **rk)
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON response from %s", url)
                return []
        
        return self._parse_add_anime(response_text, add_cfg, **rk)

    def _resolve_detail_url(self, url: str, section_name: str = "anime_complete") -> str:
        """Transform URL using link_complete config if available."""
        link_cfg = self.config.get_section("link_complete")
        if not link_cfg:
            return url
        
        # Extract uniq from URL if possible (assuming URL ends with /{uniq})
        uniq = url.rstrip("/").split("/")[-1]
        
        base_url = link_cfg.get("base_url", "")
        resolved_url = self.resolver.resolve(base_url, uniq=uniq, current_url=url)
        return resolved_url

    async def parse_details(self, url: str) -> dict:
        section = self.config.get_section("anime_complete")
        if not section:
            return {"url": url, "title": ""}
        
        # Transform URL using link_complete if configured
        api_url = self._resolve_detail_url(url, "anime_complete")
        
        headers = section.get("headers")
        encoding = section.get("encoding")
        
        # Check if this is JSON API parsing
        is_json = section.get("json_content", False)
        
        response_text = await self._fetch(api_url, headers=headers, encoding=encoding)
        rk = {"current_url": url}
        result: dict[str, Any] = {"url": url}
        
        if is_json:
            try:
                import json
                json_data = json.loads(response_text)
                return self._parse_details_json(json_data, section, **rk)
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON details from %s", url)
                return result
        
        simple_fields = ("title", "additional_title", "alt_title", "cover", "summary",
                         "production_year", "episodes", "ep_length", "country", "author", "uniq")
        for field in simple_fields:
            cfg = section.get(field)
            if cfg and isinstance(cfg, (dict, str)):
                if isinstance(field, str) and field.startswith("!"):
                    continue
                val = extract_value(response_text, cfg, self.resolver, **rk)
                if val:
                    result[field] = val
        status_cfg = section.get("status")
        if status_cfg:
            result["status"] = resolve_status(response_text, status_cfg)
        ct_cfg = section.get("content_type")
        if ct_cfg:
            result["content_type"] = resolve_content_type(response_text, ct_cfg)
        for list_field in ("add_genre", "add_genres", "add_dubber", "add_producers"):
            cfg = section.get(list_field)
            if not cfg:
                continue
            out_key = list_field.replace("add_", "")
            if out_key == "genre":
                out_key = "genres"
            elif out_key == "dubber":
                out_key = "dubbers"
            if isinstance(cfg, str):
                result[out_key] = [cfg]
            elif isinstance(cfg, dict):
                if "split" in cfg:
                    result[out_key] = extract_split(response_text, cfg, self.resolver, **rk)
                elif "next" in cfg:
                    items = self._parse_iterate_simple(response_text, cfg, **rk)
                    result[out_key] = items
                else:
                    val = extract_value(response_text, cfg, self.resolver, **rk)
                    if val:
                        result[out_key] = [val]
        is_subs = section.get("is_have_subs")
        if is_subs and isinstance(is_subs, str):
            result["is_have_subs"] = is_subs in response_text
        related = section.get("related")
        if related and isinstance(related, dict):
            val = extract_value(response_text, related, self.resolver, **rk)
            if val:
                result["related"] = val
        if "title" not in result:
            result["title"] = ""
        
        # Parse torrents if config exists
        torrents_cfg = self.config.get_section("torrents_complete")
        if torrents_cfg:
            result["torrents"] = self._parse_torrents(response_text, torrents_cfg, **rk)
            
        return result
    
    def _parse_details_json(self, json_data: dict, section: dict, **kw) -> dict:
        """Parse anime details from JSON API response."""
        result: dict[str, Any] = {"url": kw.get("current_url", "")}
        
        simple_fields = ("title", "additional_title", "alt_title", "cover", "summary",
                         "production_year", "episodes", "ep_length", "country", "author", "uniq")
        for field in simple_fields:
            cfg = section.get(field)
            if cfg and isinstance(cfg, dict) and "from" in cfg:
                val = self._get_json_value(json_data, cfg["from"])
                if val:
                    # Handle replace config
                    replace_cfg = cfg.get("replace", {})
                    if replace_cfg.get("prefix"):
                        val = self.resolver.resolve(replace_cfg["prefix"], **kw) + str(val)
                    if replace_cfg.get("suffix"):
                        val = str(val) + replace_cfg["suffix"]
                    if replace_cfg.get("unescape_unicode"):
                        val = _unescape(str(val))
                    result[field] = val
            elif cfg and isinstance(cfg, str):
                result[field] = cfg
        
        # Handle status with mapping
        status_cfg = section.get("status")
        if status_cfg and isinstance(status_cfg, dict):
            if "from" in status_cfg:
                status_val = self._get_json_value(json_data, status_cfg["from"])
                mapping = status_cfg.get("mapping", {})
                if status_val is not None:
                    str_val = str(status_val).lower()
                    result["status"] = mapping.get(str_val, "unknown")
            elif "default" in status_cfg:
                result["status"] = status_cfg["default"]
        
        # Handle content_type
        ct_cfg = section.get("content_type")
        if ct_cfg and isinstance(ct_cfg, dict) and "default" in ct_cfg:
            result["content_type"] = ct_cfg["default"]
        
        # Handle genres and other list fields
        for list_field in ("add_genre", "add_genres", "add_dubber", "add_producers"):
            cfg = section.get(list_field)
            if not cfg:
                continue
            out_key = list_field.replace("add_", "")
            if out_key == "genre":
                out_key = "genres"
            elif out_key == "dubber":
                out_key = "dubbers"
            
            if isinstance(cfg, str):
                result[out_key] = [cfg]
            elif isinstance(cfg, dict) and "from" in cfg:
                items = self._get_json_value(json_data, cfg["from"])
                if isinstance(items, list):
                    field_name = cfg.get("field", "name")
                    result[out_key] = [item.get(field_name, str(item)) if isinstance(item, dict) else str(item) for item in items]
        
        if "title" not in result:
            result["title"] = ""
            
        return result

    def _parse_torrents(self, html_text: str, torrents_cfg: dict, **kw) -> list[dict]:
        results = []
        add_torrent = torrents_cfg.get("add_torrent", [])
        strategies = add_torrent if isinstance(add_torrent, list) else [add_torrent]
        
        for strat in strategies:
            if not isinstance(strat, dict):
                continue
            
            text = html_text
            start = strat.get("start")
            if start:
                idx = text.find(start)
                if idx != -1:
                    text = text[idx:]
            
            end_marker = strat.get("end")
            next_cfg = strat.get("next")
            if not next_cfg:
                continue
                
            next_str, next_re = get_next_delimiter(next_cfg)
            blocks = split_blocks(text, next_str, next_re, end_marker)
            
            for block in blocks:
                link = extract_value(block, strat.get("link", {}), self.resolver, **kw)
                if not link:
                    continue
                
                item = {"url": link}
                for field in ("title", "size", "seeders", "leechers", "downloads", "date"):
                    cfg = strat.get(field)
                    if cfg:
                        val = extract_value(block, cfg, self.resolver, **kw)
                        if val:
                            item[field] = val
                
                if "title" not in item:
                    item["title"] = link
                results.append(item)
                
        return results

    def _parse_iterate_simple(self, html_text: str, cfg: dict, **kw) -> list[str]:
        text = html_text
        start = cfg.get("start")
        if start:
            idx = text.find(start)
            if idx == -1:
                return []
            text = text[idx:]
        end = cfg.get("end")
        if end:
            idx = text.find(end)
            if idx != -1:
                text = text[:idx]
        next_str = cfg.get("next")
        if not next_str:
            val = extract_value(text, cfg, self.resolver, **kw)
            return [val] if val else []
        parts = text.split(next_str)
        results = []
        for part in parts[1:]:
            t1 = cfg.get("token1")
            t2 = cfg.get("token2")
            if t1 and t2:
                i1 = part.find(t1)
                if i1 == -1:
                    continue
                s = i1 + len(t1)
                i2 = part.find(t2, s)
                if i2 == -1:
                    continue
                val = part[s:i2].strip()
                val = apply_replace(val, cfg.get("replace"), self.resolver, **kw)
                if val:
                    results.append(val)
        return results

    async def parse_episodes(self, url: str) -> dict:
        section = self.config.get_section("episodes_complete")
        if not section:
            return {"anime_url": url, "episodes": []}
        
        # Transform URL using link_complete if configured
        api_url = self._resolve_detail_url(url, "episodes_complete")
        
        headers = section.get("headers")
        encoding = section.get("encoding")
        
        # Check if this is JSON API parsing
        is_json = section.get("json_content", False)
        
        response_text = await self._fetch(api_url, headers=headers, encoding=encoding)
        rk = {"current_url": url}
        result = {"anime_url": url, "episodes": [], "episodes_from_page": None}
        
        if is_json:
            try:
                import json
                json_data = json.loads(response_text)
                add_ep = section.get("add_episode", [])
                if not add_ep:
                    return result
                strategies = add_ep if isinstance(add_ep, list) else [add_ep]
                for strat in strategies:
                    if not isinstance(strat, dict):
                        continue
                    try:
                        eps = self._parse_episode_strategy_json(json_data, strat, **rk)
                        result["episodes"].extend(eps)
                    except Exception as e:
                        if strat.get("may_be_null"):
                            logger.debug("Strategy may_be_null, skipping: %s", e)
                            continue
                        logger.warning("Episode JSON strategy failed: %s", e)
                return result
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON episodes from %s", url)
                return result
        
        efp_cfg = section.get("episodes_from_page")
        if efp_cfg and isinstance(efp_cfg, dict):
            efp_headers = efp_cfg.get("headers")
            efp_url = extract_value(response_text, efp_cfg, self.resolver, **rk)
            if efp_url:
                result["episodes_from_page"] = efp_url
                try:
                    efp_encoding = efp_cfg.get("encoding")
                    response_text = await self._fetch(efp_url, headers=efp_headers, encoding=efp_encoding)
                except Exception as e:
                    logger.warning("Failed to fetch episodes_from_page %s: %s", efp_url, e)
        add_ep = section.get("add_episode", [])
        if not add_ep:
            return result
        strategies = add_ep if isinstance(add_ep, list) else [add_ep]
        for strat in strategies:
            if not isinstance(strat, dict):
                continue
            try:
                eps = self._parse_episode_strategy(response_text, strat, **rk)
                result["episodes"].extend(eps)
            except Exception as e:
                if strat.get("may_be_null"):
                    logger.debug("Strategy may_be_null, skipping: %s", e)
                    continue
                logger.warning("Episode strategy failed: %s", e)
        return result
    
    def _parse_episode_strategy_json(self, json_data: dict, strat: dict, **kw) -> list[dict]:
        """Parse episodes from JSON API response."""
        episodes = []
        iterator = strat.get("iterator", {})
        path = iterator.get("path", "")
        
        # Get the array of episodes from the JSON path
        items = json_data
        if path:
            items = self._get_json_value(json_data, path)
        
        if not isinstance(items, list):
            return episodes
        
        direct = strat.get("direct_links", False)
        
        for item_data in items:
            if not isinstance(item_data, dict):
                continue
            
            # Extract link
            link_cfg = iterator.get("link", {})
            if not link_cfg:
                continue
            
            link = self._get_json_value(item_data, link_cfg.get("from", ""))
            if not link:
                continue
            
            ep: dict[str, Any] = {"url": link, "direct_links": direct}
            
            # Extract title
            title_cfg = iterator.get("title")
            if title_cfg and isinstance(title_cfg, dict) and "from" in title_cfg:
                title = self._get_json_value(item_data, title_cfg["from"])
                if title:
                    # Handle replace config
                    replace_cfg = title_cfg.get("replace", {})
                    if replace_cfg.get("suffix"):
                        title = str(title) + replace_cfg["suffix"]
                    ep["title"] = title
            
            # Extract uniq
            uniq_cfg = iterator.get("uniq")
            if uniq_cfg and isinstance(uniq_cfg, dict) and "from" in uniq_cfg:
                uniq = self._get_json_value(item_data, uniq_cfg["from"])
                if uniq:
                    replace_cfg = uniq_cfg.get("replace", {})
                    if replace_cfg.get("suffix"):
                        uniq = str(uniq) + replace_cfg["suffix"]
                    ep["uniq"] = uniq
            
            # Extract additional quality URLs (url360, url720)
            for quality_field in ("url360", "url720"):
                quality_cfg = iterator.get(quality_field)
                if quality_cfg and isinstance(quality_cfg, dict) and "from" in quality_cfg:
                    quality_url = self._get_json_value(item_data, quality_cfg["from"])
                    if quality_url:
                        ep[quality_field] = quality_url
            
            if "title" not in ep:
                ep["title"] = link
            
            episodes.append(ep)
        
        return episodes

    def _parse_episode_strategy(self, html_text: str, strat: dict, **kw) -> list[dict]:
        text = html_text
        start = strat.get("start")
        if start:
            idx = text.find(start)
            if idx == -1:
                if strat.get("may_be_null"):
                    return []
                return []
            text = text[idx:]
        end = strat.get("end")
        next_cfg = strat.get("next")
        if not next_cfg:
            return []
        next_str, next_re = get_next_delimiter(next_cfg)
        blocks = split_blocks(text, next_str, next_re, end)
        episodes = []
        direct = strat.get("direct_links", False)
        service = strat.get("service")
        for block in blocks:
            link = extract_value(block, strat.get("link", {}), self.resolver, **kw)
            if not link:
                continue
            ep: dict[str, Any] = {"url": link, "direct_links": direct}
            if service:
                ep["service"] = service
            for f in ("title", "uniq"):
                cfg = strat.get(f)
                if cfg:
                    val = extract_value(block, cfg, self.resolver, **kw)
                    if val:
                        ep[f] = val
            for qf in ("url360", "url720"):
                cfg = strat.get(qf)
                if cfg:
                    val = extract_value(block, cfg, self.resolver, **kw)
                    if val:
                        ep[qf] = val
            add_links = strat.get("add_links", [])
            if add_links:
                ep["links"] = []
                for al in add_links:
                    lval = extract_value(block, al.get("link", {}), self.resolver, **kw)
                    if lval:
                        ep["links"].append({"name": al.get("name", ""), "url": lval})
            if "title" not in ep:
                ep["title"] = link
            episodes.append(ep)
        return episodes

    def get_video_info(self, url: str) -> dict:
        section = self.config.get_section("episode_complete") or {}
        headers = {}
        if section.get("headers"):
            headers = {k: self.resolver.resolve(v, current_url=url) for k, v in section["headers"].items()}
        video_headers = {}
        if section.get("video_headers"):
            video_headers = {k: self.resolver.resolve(v, current_url=url) for k, v in section["video_headers"].items()}
        
        logger.info(f"get_video_info called for URL: {url}")
        logger.info(f"use_content_parser: {section.get('use_content_parser')}")
        logger.info(f"form_data_tag: {section.get('form_data_tag')}")
        
        # Check if content parser should be used
        if section.get("use_content_parser"):
            form_data_tag = section.get("form_data_tag")
            logger.info(f"Content parser enabled with tag: {form_data_tag}")
            if form_data_tag:
                parser = content_parsers.get_content_parser(form_data_tag, self.http)
                logger.info(f"Content parser found: {parser is not None}")
                if parser and hasattr(parser, 'get_video_info'):
                    logger.info("Parser has get_video_info method, using async parsing")
                    # Always use async parsing for content parsers
                    return {
                        "url": url,
                        "headers": {**headers, **video_headers},
                        "referer": headers.get("Referer"),
                        "direct": True,
                        "needs_async_parsing": True,
                        "form_data_tag": form_data_tag
                    }
                else:
                    logger.warning(f"No content parser found for tag: {form_data_tag}")
            else:
                logger.warning("No form_data_tag found")
        else:
            logger.info("Content parser not enabled")
        
        logger.info("Returning basic video info")
        return {
            "url": url,
            "headers": {**headers, **video_headers},
            "referer": headers.get("Referer"),
            "direct": bool(section.get("use_content_parser")),
        }

    async def parse_filters(self) -> list[dict]:
        section = self.config.get_section("anime_list_filters_complete")
        if not section:
            return []
        filters = []
        unified = section.get("filters", {})
        if isinstance(unified, dict):
            for key, val in sorted(unified.items()):
                if not isinstance(val, dict):
                    continue
                opts = []
                for v in val.get("values", []):
                    if "n_v" in v:
                        opts.append({"name": v["n_v"], "value": v["n_v"]})
                    else:
                        opts.append({"name": v.get("name", ""), "value": v.get("value", "")})
                filters.append({
                    "name": val.get("name", key),
                    "filter_key": key,
                    "choice_mode": val.get("choice_mode", "single"),
                    "options": opts,
                })
        for ftype in ("genre_filters", "year_filters"):
            ft = section.get(ftype)
            if not ft or not ft.get("filters"):
                continue
            opts = []
            for v in ft["filters"]:
                if "n_v" in v:
                    opts.append({"name": v["n_v"], "value": v["n_v"]})
                else:
                    opts.append({"name": v.get("name", ""), "value": v.get("value", "")})
            filters.append({
                "name": ftype.replace("_filters", "").replace("_", " ").title(),
                "filter_key": ftype,
                "choice_mode": "single",
                "options": opts,
            })
        return filters

    def list_categories(self) -> list[dict]:
        section = self.config.get_section("anime_list_complete")
        if not section:
            return []
        iterator = section.get("iterator")
        if not iterator:
            return []
        iters = iterator if isinstance(iterator, list) else [iterator]
        cats = []
        for it in iters:
            cat = it.get("category", {})
            if cat:
                cats.append({"tag": cat.get("tag", ""), "name": cat.get("name", "")})
        return cats

    async def parse_schedule(self) -> list[dict]:
        """Parse schedule/upcoming episodes from main page."""
        # Fetch main page
        url = self.resolver.resolve("$scheme$//$hostname$/")
        try:
            html_text = await self._fetch(url)
        except Exception as e:
            logger.warning("Failed to fetch schedule: %s", e)
            return []

        schedule = []
        # Find head-body section
        start_marker = '<div class="head-body">'
        start_idx = html_text.find(start_marker)
        if start_idx == -1:
            return []

        # Extract schedule section
        end_marker = '<div class="clear clr">'
        end_idx = html_text.find(end_marker, start_idx)
        if end_idx == -1:
            section = html_text[start_idx:]
        else:
            section = html_text[start_idx:end_idx]

        # Parse each scoro (column)
        scoro_start = '<div class="scoro">'
        pos = 0
        while True:
            scoro_idx = section.find(scoro_start, pos)
            if scoro_idx == -1:
                break

            # Find end of this scoro
            next_scoro = section.find(scoro_start, scoro_idx + len(scoro_start))
            if next_scoro == -1:
                scoro_section = section[scoro_idx:]
            else:
                scoro_section = section[scoro_idx:next_scoro]

            # Parse anime items in this column
            cal_start = '<div class="main-cal"'
            cal_pos = 0
            while True:
                cal_idx = scoro_section.find(cal_start, cal_pos)
                if cal_idx == -1:
                    break

                # Find end of main-cal
                next_cal = scoro_section.find(cal_start, cal_idx + len(cal_start))
                if next_cal == -1:
                    cal_end = len(scoro_section)
                else:
                    cal_end = next_cal

                cal_block = scoro_section[cal_idx:cal_end]

                # Extract image URL from background-image
                img_url = None
                bg_match = re.search(r"background-image:url\('([^']+)'\)", cal_block)
                if bg_match:
                    img_url = bg_match.group(1)
                    if img_url.startswith('/'):
                        img_url = self.resolver.resolve("$scheme$//$hostname$") + img_url

                # Extract link
                link = None
                link_match = re.search(r'<a href="([^"]+)"', cal_block)
                if link_match:
                    link = link_match.group(1)
                    if link.startswith('/'):
                        link = self.resolver.resolve("$scheme$//$hostname$") + link

                # Extract title
                title = None
                title_match = re.search(r'<span class="anime_title_cal[^"]*">.*?<a[^>]*>([^<]+)</a>', cal_block, re.DOTALL)
                if title_match:
                    title = title_match.group(1).strip()

                # Extract countdown/time
                time_left = None
                time_match = re.search(r'<span class="newdate-clock[^"]*">.*?<span>([^<]+)</span>', cal_block, re.DOTALL)
                if time_match:
                    time_left = time_match.group(1).strip()

                if title and link:
                    schedule.append({
                        "title": title,
                        "url": link,
                        "cover": img_url,
                        "time_left": time_left,
                    })

                cal_pos = cal_idx + len(cal_start)

            pos = scoro_idx + len(scoro_start)

        return schedule
