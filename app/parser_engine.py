"""Core DSL interpreter for AniLabX JSON parser configs."""
from __future__ import annotations
import html
import logging
import re
from typing import Any
from app.variable_resolver import VariableResolver
from app.http_client import HttpClient
from app.config_loader import ParserConfig

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
                value = re.sub(resolved_match, resolved_text, value)
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
                     form_data: dict | None = None) -> str:
        merged = {}
        if self.config.user_agent:
            merged["User-Agent"] = self.config.user_agent
        if headers:
            merged.update(headers)
        if method == "POST":
            return await self.http.post(url, headers=merged, form_data=form_data,
                                        encoding=self.config.encoding, user_agent=self.config.user_agent)
        return await self.http.get(url, headers=merged, encoding=self.config.encoding,
                                   user_agent=self.config.user_agent)

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
        html_text = await self._fetch(search_link, method=method, headers=headers, form_data=form_data)
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
        html_text = await self._fetch(url, method=method, headers=headers, form_data=form_data)
        return self._parse_add_anime(html_text, add_cfg, **rk)

    async def parse_details(self, url: str) -> dict:
        section = self.config.get_section("anime_complete")
        if not section:
            return {"url": url, "title": ""}
        headers = section.get("headers")
        html_text = await self._fetch(url, headers=headers)
        rk = {"current_url": url}
        result: dict[str, Any] = {"url": url}
        simple_fields = ("title", "additional_title", "alt_title", "cover", "summary",
                         "production_year", "episodes", "ep_length", "country", "author", "uniq")
        for field in simple_fields:
            cfg = section.get(field)
            if cfg and isinstance(cfg, (dict, str)):
                if isinstance(field, str) and field.startswith("!"):
                    continue
                val = extract_value(html_text, cfg, self.resolver, **rk)
                if val:
                    result[field] = val
        status_cfg = section.get("status")
        if status_cfg:
            result["status"] = resolve_status(html_text, status_cfg)
        ct_cfg = section.get("content_type")
        if ct_cfg:
            result["content_type"] = resolve_content_type(html_text, ct_cfg)
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
                    result[out_key] = extract_split(html_text, cfg, self.resolver, **rk)
                elif "next" in cfg:
                    items = self._parse_iterate_simple(html_text, cfg, **rk)
                    result[out_key] = items
                else:
                    val = extract_value(html_text, cfg, self.resolver, **rk)
                    if val:
                        result[out_key] = [val]
        is_subs = section.get("is_have_subs")
        if is_subs and isinstance(is_subs, str):
            result["is_have_subs"] = is_subs in html_text
        related = section.get("related")
        if related and isinstance(related, dict):
            val = extract_value(html_text, related, self.resolver, **rk)
            if val:
                result["related"] = val
        if "title" not in result:
            result["title"] = ""
        return result

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
        headers = section.get("headers")
        html_text = await self._fetch(url, headers=headers)
        rk = {"current_url": url}
        result = {"anime_url": url, "episodes": [], "episodes_from_page": None}
        efp_cfg = section.get("episodes_from_page")
        if efp_cfg and isinstance(efp_cfg, dict):
            efp_headers = efp_cfg.get("headers")
            efp_url = extract_value(html_text, efp_cfg, self.resolver, **rk)
            if efp_url:
                result["episodes_from_page"] = efp_url
                try:
                    html_text = await self._fetch(efp_url, headers=efp_headers)
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
                eps = self._parse_episode_strategy(html_text, strat, **rk)
                result["episodes"].extend(eps)
            except Exception as e:
                if strat.get("may_be_null"):
                    logger.debug("Strategy may_be_null, skipping: %s", e)
                    continue
                logger.warning("Episode strategy failed: %s", e)
        return result

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
