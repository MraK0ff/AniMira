package com.animira.tv

import android.util.Log
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLDecoder
import java.util.regex.Pattern

/**
 * Utility class for handling file downloads with proper Content-Disposition parsing.
 * Supports both "attachment" and "inline" disposition types per RFC 6266/5987.
 */
object DownloadUtils {

    private const val TAG = "DownloadUtils"

    // Pattern to match Content-Disposition header: disposition-type; parameters
    // Supports both "attachment" and "inline" disposition types
    private val CONTENT_DISPOSITION_PATTERN = Pattern.compile(
        "(?:attachment|inline)\\s*;\\s*filename\\s*=\\s*(?:\"((?:\\.|[^\"\\\\])*)\"|([^;\\s]*))",
        Pattern.CASE_INSENSITIVE
    )

    // Pattern for RFC 5987/8187 encoded filenames: filename*=charset'lang'encoded-value
    private val CONTENT_DISPOSITION_PATTERN_RFC_5987 = Pattern.compile(
        "(?:attachment|inline)\\s*;\\s*filename\\*\\s*=\\s*([^']*)'[^']*'([^;\\s]*)",
        Pattern.CASE_INSENSITIVE
    )

    /**
     * Guess filename from URL and optional Content-Disposition header.
     * First tries to extract from Content-Disposition (both attachment and inline),
     * then falls back to URL path.
     */
    fun guessFileName(url: String, contentDisposition: String?, mimeType: String?): String {
        var filename: String? = null
        var extension: String? = null

        // Try to extract from Content-Disposition header
        if (contentDisposition != null) {
            filename = parseContentDispositionFilename(contentDisposition)
            Log.d(TAG, "Extracted filename from Content-Disposition: $filename")
        }

        // If no filename from header, try URL path
        if (filename == null) {
            filename = getFilenameFromUrl(url)
            Log.d(TAG, "Extracted filename from URL: $filename")
        }

        // Parse extension from filename
        if (filename != null) {
            val dotIndex = filename.lastIndexOf('.')
            if (dotIndex >= 0) {
                extension = filename.substring(dotIndex + 1)
                filename = filename.substring(0, dotIndex)
            }
        }

        // If still no filename, use default
        if (filename == null || filename.isEmpty()) {
            filename = "download"
        }

        // Add extension based on MIME type if missing
        if (extension == null || extension.isEmpty()) {
            extension = getExtensionFromMimeType(mimeType)
        }

        // Default extension for torrent files
        if (extension == null && url.contains("torrent")) {
            extension = "torrent"
        }

        return if (extension != null && extension.isNotEmpty()) {
            "$filename.$extension"
        } else {
            filename
        }
    }

    /**
     * Parse filename from Content-Disposition header.
     * Supports both regular and RFC 5987/8187 encoded filenames.
     * Handles both "attachment" and "inline" disposition types.
     */
    private fun parseContentDispositionFilename(contentDisposition: String): String? {
        try {
            // Try RFC 5987/8187 encoded filename first (filename*=charset'lang'value)
            var matcher = CONTENT_DISPOSITION_PATTERN_RFC_5987.matcher(contentDisposition)
            if (matcher.find()) {
                val charset = matcher.group(1) ?: "UTF-8"
                val encodedFilename = matcher.group(2) ?: return null
                return decodeRfc5987Filename(encodedFilename, charset)
            }

            // Try regular filename (filename="value" or filename=value)
            matcher = CONTENT_DISPOSITION_PATTERN.matcher(contentDisposition)
            if (matcher.find()) {
                // Group 1 is quoted string, group 2 is unquoted
                var filename = matcher.group(1)
                if (filename == null) {
                    filename = matcher.group(2)
                }
                return filename?.replace("\\\\\"", "\"")?.replace("\\\\", "\\")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error parsing Content-Disposition: $contentDisposition", e)
        }
        return null
    }

    /**
     * Decode RFC 5987/8187 encoded filename.
     */
    private fun decodeRfc5987Filename(encoded: String, charset: String): String {
        return try {
            // Percent-decode the string
            val bytes = mutableListOf<Byte>()
            var i = 0
            while (i < encoded.length) {
                if (encoded[i] == '%' && i + 2 < encoded.length) {
                    val hex = encoded.substring(i + 1, i + 3)
                    try {
                        bytes.add(hex.toInt(16).toByte())
                        i += 3
                        continue
                    } catch (_: NumberFormatException) {
                    }
                }
                bytes.add(encoded[i].code.toByte())
                i++
            }
            String(bytes.toByteArray(), java.nio.charset.Charset.forName(charset.ifEmpty { "UTF-8" }))
        } catch (e: Exception) {
            Log.w(TAG, "Failed to decode RFC 5987 filename, falling back to URL decode", e)
            URLDecoder.decode(encoded, "UTF-8")
        }
    }

    /**
     * Extract filename from URL path.
     */
    private fun getFilenameFromUrl(url: String): String? {
        return try {
            val parsedUrl = URL(url)
            val path = parsedUrl.path
            val lastSlash = path.lastIndexOf('/')
            val filename = if (lastSlash >= 0) {
                path.substring(lastSlash + 1)
            } else {
                path
            }
            // URL decode the filename
            URLDecoder.decode(filename, "UTF-8").takeIf { it.isNotEmpty() }
        } catch (e: Exception) {
            Log.w(TAG, "Error extracting filename from URL: $url", e)
            null
        }
    }

    /**
     * Get file extension from MIME type.
     */
    private fun getExtensionFromMimeType(mimeType: String?): String? {
        return when (mimeType?.lowercase()) {
            "application/x-bittorrent", "application/bittorrent" -> "torrent"
            "video/mp4" -> "mp4"
            "video/x-matroska" -> "mkv"
            "video/avi" -> "avi"
            "application/vnd.apple.mpegurl", "application/x-mpegurl" -> "m3u8"
            else -> null
        }
    }

    /**
     * Fetch Content-Disposition header from URL via HEAD request.
     * Returns null if request fails.
     */
    fun fetchContentDisposition(url: String): String? {
        return try {
            val connection = URL(url).openConnection() as HttpURLConnection
            connection.requestMethod = "HEAD"
            connection.connectTimeout = 10000
            connection.readTimeout = 10000
            connection.setRequestProperty("User-Agent", "AniMira/1.0")
            connection.connect()

            val contentDisposition = connection.getHeaderField("Content-Disposition")
            connection.disconnect()

            Log.d(TAG, "Fetched Content-Disposition for $url: $contentDisposition")
            contentDisposition
        } catch (e: Exception) {
            Log.w(TAG, "Failed to fetch Content-Disposition for $url", e)
            null
        }
    }
}
