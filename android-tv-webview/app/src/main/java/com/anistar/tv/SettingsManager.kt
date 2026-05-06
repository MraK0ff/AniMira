package com.anistar.tv

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import java.net.NetworkInterface
import java.util.Collections

class SettingsManager(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    companion object {
        private const val PREFS_NAME = "anistar_settings"
        private const val KEY_BASE_URL = "base_url"
        private const val KEY_TORRSERVE_HOST = "torrserve_host"
        // Default site URL - user should change this to their PC's IP
        private const val DEFAULT_URL = "http://192.168.2.7:5173"
        // TorrServe runs on the TV itself (localhost)
        private const val DEFAULT_TORRSERVE = "localhost:8090"
        private const val TAG = "SettingsManager"
    }

    fun getBaseUrl(): String {
        return prefs.getString(KEY_BASE_URL, DEFAULT_URL) ?: DEFAULT_URL
    }

    fun setBaseUrl(url: String) {
        prefs.edit().putString(KEY_BASE_URL, url).apply()
    }

    fun getTorrServeHost(): String {
        return prefs.getString(KEY_TORRSERVE_HOST, DEFAULT_TORRSERVE) ?: DEFAULT_TORRSERVE
    }

    fun setTorrServeHost(host: String) {
        prefs.edit().putString(KEY_TORRSERVE_HOST, host).apply()
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
        val ips = getLocalIpAddresses()
        val commonSubnets = listOf("192.168.1", "192.168.2", "192.168.0", "10.0.0", "10.19")

        // Try to find IP in common subnets
        for (subnet in commonSubnets) {
            val match = ips.find { it.startsWith(subnet) }
            if (match != null) {
                Log.d(TAG, "Using IP from subnet $subnet: $match")
                return "http://$match:5173"
            }
        }

        // Return first available or default
        return if (ips.isNotEmpty()) {
            "http://${ips.first()}:5173"
        } else {
            DEFAULT_URL
        }
    }
}
