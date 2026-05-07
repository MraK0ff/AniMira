package com.animira.tv

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.util.Log
import androidx.appcompat.app.AlertDialog
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

class Updater(private val context: Context) {

    companion object {
        private const val TAG = "AniMiraUpdater"
        private const val APK_FILENAME = "animira-tv.apk"
    }

    data class UpdateInfo(
        val versionCode: Int,
        val versionName: String,
        val downloadUrl: String,
        val changelog: String
    )

    fun checkForUpdates(onUpdateAvailable: (UpdateInfo) -> Unit, onNoUpdate: () -> Unit = {}, onError: (String) -> Unit = {}) {
        Thread {
            try {
                val currentVersion = BuildConfig.VERSION_CODE
                val updateServerUrl = BuildConfig.UPDATE_SERVER_URL

                Log.d(TAG, "Checking for updates at: $updateServerUrl/api/version")
                Log.d(TAG, "Current version: $currentVersion")

                val url = URL("$updateServerUrl/api/version")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "GET"
                connection.connectTimeout = 10000
                connection.readTimeout = 10000

                val responseCode = connection.responseCode
                if (responseCode == 200) {
                    val response = connection.inputStream.bufferedReader().use { it.readText() }
                    Log.d(TAG, "Server response: $response")

                    val json = JSONObject(response)
                    val serverVersionCode = json.getInt("version_code")
                    val versionName = json.getString("version_name")
                    val downloadUrl = json.getString("download_url")
                    val changelog = json.optString("changelog", "")

                    Log.d(TAG, "Server version: $serverVersionCode, Current: $currentVersion")

                    if (serverVersionCode > currentVersion) {
                        val updateInfo = UpdateInfo(
                            versionCode = serverVersionCode,
                            versionName = versionName,
                            downloadUrl = downloadUrl,
                            changelog = changelog
                        )
                        context.mainExecutor.execute {
                            onUpdateAvailable(updateInfo)
                        }
                    } else {
                        context.mainExecutor.execute {
                            onNoUpdate()
                        }
                    }
                } else {
                    context.mainExecutor.execute {
                        onError("Server returned code: $responseCode")
                    }
                }
                connection.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "Error checking for updates", e)
                context.mainExecutor.execute {
                    onError(e.message ?: "Unknown error")
                }
            }
        }.start()
    }

    fun showUpdateDialog(updateInfo: UpdateInfo, onDownload: () -> Unit, onCancel: () -> Unit = {}) {
        val message = buildString {
            append("Доступна новая версия: ${updateInfo.versionName}\n\n")
            if (updateInfo.changelog.isNotEmpty()) {
                append("Изменения:\n${updateInfo.changelog}\n\n")
            }
            append("Обновить сейчас?")
        }

        AlertDialog.Builder(context)
            .setTitle("Обновление доступно")
            .setMessage(message)
            .setPositiveButton("Обновить") { _, _ ->
                onDownload()
            }
            .setNegativeButton("Позже") { _, _ ->
                onCancel()
            }
            .setCancelable(false)
            .show()
    }

    fun downloadAndInstallApk(downloadUrl: String) {
        try {
            Log.d(TAG, "Starting download from: $downloadUrl")

            // Delete old APK if exists
            val apkFile = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_FILENAME)
            if (apkFile.exists()) {
                apkFile.delete()
            }

            val request = DownloadManager.Request(Uri.parse(downloadUrl)).apply {
                setTitle("AniMira Update")
                setDescription("Загрузка обновления...")
                setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, APK_FILENAME)
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI or DownloadManager.Request.NETWORK_MOBILE)
            }

            val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val downloadId = downloadManager.enqueue(request)

            Log.d(TAG, "Download started with ID: $downloadId")

            // Register receiver to handle download completion
            val receiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    val id = intent?.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
                    if (id == downloadId) {
                        Log.d(TAG, "Download completed")
                        context?.unregisterReceiver(this)
                        installApk(apkFile)
                    }
                }
            }

            context.registerReceiver(receiver, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE))

        } catch (e: Exception) {
            Log.e(TAG, "Error starting download", e)
            // Fallback: open browser
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl))
            context.startActivity(intent)
        }
    }

    fun installApk(apkFile: File) {
        try {
            Log.d(TAG, "Installing APK: ${apkFile.absolutePath}")

            if (!apkFile.exists()) {
                Log.e(TAG, "APK file not found")
                return
            }

            val uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    apkFile
                )
            } else {
                Uri.fromFile(apkFile)
            }

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            context.startActivity(intent)
            Log.d(TAG, "Install intent started")

        } catch (e: Exception) {
            Log.e(TAG, "Error installing APK", e)
        }
    }
}
