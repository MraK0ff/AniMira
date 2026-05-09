package com.animira.tv

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import java.net.NetworkInterface
import java.util.Collections

class SettingsManager(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    companion object {
        private const val PREFS_NAME = "animira_settings"
        private const val KEY_BASE_URL = "base_url"
        // Default site URL - cloud server
        private const val DEFAULT_URL = "https://animira.onrender.com"
        private const val TAG = "SettingsManager"
    }

    fun getBaseUrl(): String {
        return prefs.getString(KEY_BASE_URL, DEFAULT_URL) ?: DEFAULT_URL
    }

    fun setBaseUrl(url: String) {
        prefs.edit().putString(KEY_BASE_URL, url).apply()
    }

    fun getLocalIpAddresses(): List<String> {
        val addresses = mutableListOf<String>()
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            for (networkInterface in Collections.list(interfaces)) {
                for (address in Collections.list(networkInterface.inetAddresses)) {
                    if (!address.isLoopbackAddress && address.isSiteLocalAddress) {
                        val ip = address.hostAddress?.replace("%.*".toRegex(), "")
                        if (ip != null && ip.contains(".")) {
                            addresses.add(ip)
                            Log.d(TAG, "Found IP: $ip")
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting IP addresses", e)
        }
        return addresses
    }

    fun detectServerUrl(): String {
        // First try cloud server
        if (isServerReachable(DEFAULT_URL)) {
            Log.d(TAG, "Using cloud server: $DEFAULT_URL")
            return DEFAULT_URL
        }

        // Fallback to local network auto-detection
        val ips = getLocalIpAddresses()
        val commonSubnets = listOf("192.168.1", "192.168.2", "192.168.0", "10.0.0", "10.19")

        for (subnet in commonSubnets) {
            val match = ips.find { it.startsWith(subnet) }
            if (match != null) {
                val localUrl = "http://$match:5173"
                if (isServerReachable(localUrl)) {
                    Log.d(TAG, "Using local server from subnet $subnet: $localUrl")
                    return localUrl
                }
            }
        }

        // Return first available IP or default
        return if (ips.isNotEmpty()) {
            "http://${ips.first()}:5173"
        } else {
            DEFAULT_URL
        }
    }

    private fun isServerReachable(url: String): Boolean {
        return try {
            val connection = java.net.URL(url).openConnection() as java.net.HttpURLConnection
            connection.connectTimeout = 3000
            connection.readTimeout = 3000
            connection.requestMethod = "HEAD"
            val responseCode = connection.responseCode
            connection.disconnect()
            responseCode in 200..399
        } catch (e: Exception) {
            Log.d(TAG, "Server not reachable: $url - ${e.message}")
            false
        }
    }
}
