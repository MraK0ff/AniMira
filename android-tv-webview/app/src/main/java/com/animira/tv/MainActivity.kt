package com.animira.tv

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.database.Cursor
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.util.Log
import android.view.KeyEvent
import android.webkit.*
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var settingsManager: SettingsManager
    private var downloadReceiver: BroadcastReceiver? = null
    private val pendingTorrentDownloads = mutableMapOf<Long, String>()

    companion object {
        private const val TAG = "AniMiraTV"
        private const val ANISTAR_DOMAIN = "astar.bz"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        settingsManager = SettingsManager(this)
        webView = findViewById(R.id.webView)

        setupWebView()
        
        // Handle incoming media intents (from TorrServe or other apps)
        handleIncomingIntent(intent)
        
        loadUrl()

        // Check for updates after a short delay
        checkForUpdatesDelayed()
    }
    
    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingIntent(intent)
    }
    
    private fun handleIncomingIntent(intent: Intent?) {
        val action = intent?.action
        val data = intent?.data
        val extras = intent?.extras

        Log.d(TAG, "handleIncomingIntent: action=$action, data=$data")

        if (action == Intent.ACTION_VIEW && data != null) {
            val url = data.toString()
            val host = data.host ?: ""
            Log.d(TAG, "Received URL: $url, host: $host")

            // Handle AniStar links - convert to AniMira URL
            if (host.contains(ANISTAR_DOMAIN)) {
                handleAnistarLink(url, data)
                return
            }

            // Handle torrent/magnet links
            if (url.endsWith(".torrent") || url.contains("gettorrent.php") || data.scheme == "magnet") {
                Log.d(TAG, "Detected torrent/magnet link in intent")
                downloadAndOpenTorrent(url)
                return
            }

            // Handle TorrServe stream URLs - navigate to player
            if (url.contains("torrserve") || url.contains("/stream/") ||
                url.contains(".m3u8") || url.contains(".mp4") ||
                url.contains("video") || url.contains("playlist")) {

                // Store the media URL for the web player
                settingsManager.setPendingMediaUrl(url)
                Log.d(TAG, "Stored pending media URL: $url")

                // If webView is already loaded, navigate to player
                if (::webView.isInitialized && webView.url != null) {
                    val js = "window.location.href = '/player?torrserve_url=${Uri.encode(url)}';"
                    webView.evaluateJavascript(js, null)
                }
            }
        }

        // Handle extras from TorrServe (e.g., when TorrServe returns a stream URL)
        extras?.let {
            val streamUrl = it.getString("stream_url")
            val videoUrl = it.getString("video_url")
            val link = it.getString("link")

            val mediaUrl = streamUrl ?: videoUrl ?: link
            if (mediaUrl != null) {
                Log.d(TAG, "Received media URL from extras: $mediaUrl")
                settingsManager.setPendingMediaUrl(mediaUrl)
            }
        }
    }

    private fun handleAnistarLink(url: String, uri: Uri) {
        Log.d(TAG, "Handling AniStar link: $url")

        val path = uri.path ?: ""
        val baseUrl = settingsManager.getBaseUrl()

        // Check if it's a specific anime page or just the homepage
        val animiraUrl = if (path.isNotEmpty() && path != "/") {
            // Specific anime page - convert to AniMira anime page
            "$baseUrl/anime?source=anistar&url=${Uri.encode(url)}"
        } else {
            // Just the domain - open AniStar catalog
            "$baseUrl/anime?source=anistar"
        }

        Log.d(TAG, "Converted to AniMira URL: $animiraUrl")
        settingsManager.setPendingAnistarUrl(animiraUrl)

        // If webView is already loaded, navigate directly
        if (::webView.isInitialized && webView.url != null) {
            webView.loadUrl(animiraUrl)
            settingsManager.clearPendingAnistarUrl()
        }
    }

    private fun checkForUpdatesDelayed() {
        android.os.Handler(mainLooper).postDelayed({
            val updater = Updater(this)
            updater.checkForUpdates(
                onUpdateAvailable = { updateInfo ->
                    Log.d(TAG, "Update available: ${updateInfo.versionName} (${updateInfo.versionCode})")
                    updater.showUpdateDialog(
                        updateInfo,
                        onDownload = {
                            updater.downloadAndInstallApk(updateInfo.downloadUrl)
                        }
                    )
                },
                onNoUpdate = {
                    Log.d(TAG, "No update available or update skipped")
                },
                onError = { error ->
                    Log.e(TAG, "Update check failed: $error")
                }
            )
        }, 5000) // Check after 5 seconds to not block app startup
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

            // TV optimization
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                return handleUrl(url)
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return handleUrl(url ?: return false)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                injectTVFocusHandling()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(message: ConsoleMessage?): Boolean {
                Log.d(TAG, "WebView: ${message?.message()}")
                return true
            }
        }

        // Handle file downloads
        webView.setDownloadListener { url, userAgent, contentDisposition, mimetype, contentLength ->
            Log.d(TAG, "Download requested: $url")
            handleTorrentDownload(url)
        }

        // Add JavaScript interface for web app to communicate with Android
        webView.addJavascriptInterface(WebAppInterface(this), "Android")

        // Enable focus for TV navigation
        webView.isFocusable = true
        webView.isFocusableInTouchMode = true
    }
    
    // JavaScript interface class for communication between web and Android
    inner class WebAppInterface(private val activity: MainActivity) {
        @JavascriptInterface
        fun openTorrentInTorrServe(url: String) {
            Log.d(TAG, "Web requested to open torrent: $url")
            activity.runOnUiThread {
                handleTorrentDownload(url)
            }
        }
        
        @JavascriptInterface
        fun showToast(message: String) {
            Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
        }
    }

    private fun handleUrl(url: String): Boolean {
        val uri = Uri.parse(url)
        Log.d(TAG, "handleUrl called with: $url")

        // Handle torrent/magnet links for download
        if (url.endsWith(".torrent") || url.contains("gettorrent.php") || uri.scheme == "magnet") {
            Log.d(TAG, "Detected as torrent download")
            handleTorrentDownload(url)
            return true
        }

        // Handle intent:// URLs
        if (uri.scheme == "intent") {
            return handleIntentUrl(url)
        }

        return false
    }

    private fun handleTorrentDownload(url: String) {
        val uri = Uri.parse(url)

        // For magnet links, try to open directly first
        if (uri.scheme == "magnet") {
            try {
                val magnetIntent = Intent(Intent.ACTION_VIEW).apply {
                    data = uri
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(magnetIntent)
                Log.d(TAG, "Opened magnet link directly")
                Toast.makeText(this, "Открываем magnet ссылку...", Toast.LENGTH_SHORT).show()
                return
            } catch (e: ActivityNotFoundException) {
                Log.w(TAG, "No app found to handle magnet link, trying to download")
            }
        }

        // For .torrent files, download and open
        if (url.endsWith(".torrent") || url.contains("gettorrent.php")) {
            downloadAndOpenTorrent(url)
            return
        }

        // Fallback: Try to open directly with TorrServe or other apps
        tryOpenTorrentDirectly(uri)
    }

    private fun downloadAndOpenTorrent(url: String) {
        Log.d(TAG, "Downloading torrent file: $url")
        Toast.makeText(this, "Скачивание torrent файла...", Toast.LENGTH_SHORT).show()

        val uri = Uri.parse(url)
        val fileName = uri.lastPathSegment ?: "download.torrent"

        val request = DownloadManager.Request(uri).apply {
            setTitle(fileName)
            setDescription("Скачивание torrent файла")
            setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            allowScanningByMediaScanner()
        }

        val downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val downloadId = downloadManager.enqueue(request)

        pendingTorrentDownloads[downloadId] = fileName
        Log.d(TAG, "Started torrent download, id: $downloadId")

        // Register receiver if not already registered
        registerDownloadReceiver()
    }

    private fun registerDownloadReceiver() {
        if (downloadReceiver != null) return

        downloadReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
                if (downloadId == -1L) return

                val fileName = pendingTorrentDownloads[downloadId] ?: return
                pendingTorrentDownloads.remove(downloadId)

                val downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                val query = DownloadManager.Query().setFilterById(downloadId)
                val cursor: Cursor = downloadManager.query(query)

                if (cursor.moveToFirst()) {
                    val statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS)
                    val status = cursor.getInt(statusIndex)

                    if (status == DownloadManager.STATUS_SUCCESSFUL) {
                        val uriIndex = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI)
                        val localUri = cursor.getString(uriIndex)
                        Log.d(TAG, "Torrent download complete: $localUri")

                        // Open the downloaded torrent file
                        openTorrentFile(Uri.parse(localUri), fileName)
                    } else {
                        Log.e(TAG, "Torrent download failed with status: $status")
                        Toast.makeText(context, "Ошибка скачивания torrent", Toast.LENGTH_SHORT).show()
                    }
                }
                cursor.close()
            }
        }

        registerReceiver(downloadReceiver, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
            Context.RECEIVER_NOT_EXPORTED)
    }

    private fun openTorrentFile(uri: Uri, fileName: String) {
        Log.d(TAG, "Opening torrent file: $uri")

        try {
            // First try TorrServe
            val torrserveIntent = Intent(Intent.ACTION_VIEW).apply {
                data = uri
                setPackage("ru.yourok.torrserve")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                putExtra("action", "add")
                putExtra("play", true)
            }
            startActivity(torrserveIntent)
            Toast.makeText(this, "Открываем в TorrServe...", Toast.LENGTH_SHORT).show()
            return
        } catch (e: ActivityNotFoundException) {
            Log.w(TAG, "TorrServe not found for file")
        }

        // Try other torrent apps
        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = uri
                setType("application/x-bittorrent")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(Intent.createChooser(intent, "Открыть torrent файл"))
            return
        } catch (e: ActivityNotFoundException) {
            Log.e(TAG, "No torrent app found")
            Toast.makeText(this, "Установите TorrServe для просмотра торрентов", Toast.LENGTH_LONG).show()
        }
    }

    private fun tryOpenTorrentDirectly(uri: Uri) {
        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = uri
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
            Log.d(TAG, "Opened torrent with generic ACTION_VIEW")
        } catch (e: ActivityNotFoundException) {
            Log.e(TAG, "No app found to handle torrent")
            Toast.makeText(this, "Установите TorrServe для просмотра торрентов", Toast.LENGTH_LONG).show()
        }
    }

    private fun handleIntentUrl(url: String): Boolean {
        return try {
            val intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
            startActivity(intent)
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to handle intent URL: $url", e)
            false
        }
    }

    private fun loadUrl() {
        val baseUrl = settingsManager.getBaseUrl()
        val pendingMediaUrl = settingsManager.getPendingMediaUrl()
        val pendingAnistarUrl = settingsManager.getPendingAnistarUrl()

        when {
            pendingAnistarUrl != null -> {
                // Handle AniStar link
                Log.d(TAG, "Loading AniStar URL: $pendingAnistarUrl")
                webView.loadUrl(pendingAnistarUrl)
                settingsManager.clearPendingAnistarUrl()
            }
            pendingMediaUrl != null -> {
                // If we have a pending media URL from TorrServe, navigate directly to player
                val playerUrl = "$baseUrl/player?torrserve_url=${Uri.encode(pendingMediaUrl)}"
                Log.d(TAG, "Loading player with TorrServe URL: $playerUrl")
                webView.loadUrl(playerUrl)
                // Clear the pending URL after loading
                settingsManager.clearPendingMediaUrl()
            }
            else -> {
                Log.d(TAG, "Loading URL: $baseUrl")
                webView.loadUrl(baseUrl)
            }
        }
    }

    private fun injectTVFocusHandling() {
        val js = """
            (function() {
                // Add TV focus styles
                const style = document.createElement('style');
                style.textContent = `
                    .tv-focus:focus, .tv-focusable:focus, [tabindex]:focus {
                        outline: 3px solid #3b82f6 !important;
                        outline-offset: 2px !important;
                        box-shadow: 0 0 10px rgba(59, 130, 246, 0.5) !important;
                    }
                    a:focus, button:focus {
                        outline: 3px solid #3b82f6 !important;
                        outline-offset: 2px !important;
                    }
                `;
                document.head.appendChild(style);
            })();
        """.trimIndent()
        
        webView.evaluateJavascript(js, null)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        // Handle menu button for settings
        if (event.keyCode == KeyEvent.KEYCODE_MENU && event.action == KeyEvent.ACTION_DOWN) {
            openSettings()
            return true
        }

        // Handle back button
        if (event.keyCode == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_DOWN) {
            if (webView.canGoBack()) {
                webView.goBack()
                return true
            }
        }

        return super.dispatchKeyEvent(event)
    }

    private fun openSettings() {
        val intent = Intent(this, SettingsActivity::class.java)
        startActivity(intent)
    }

    override fun onResume() {
        super.onResume()
        // Reload if URL changed
        val currentUrl = webView.url
        val baseUrl = settingsManager.getBaseUrl()
        if (currentUrl != baseUrl && !currentUrl.isNullOrEmpty()) {
            loadUrl()
        }
    }

    override fun onDestroy() {
        // Unregister download receiver
        downloadReceiver?.let {
            try {
                unregisterReceiver(it)
            } catch (e: Exception) {
                Log.w(TAG, "Error unregistering receiver: ${e.message}")
            }
        }
        webView.destroy()
        super.onDestroy()
    }
}
