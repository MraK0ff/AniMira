package com.animira.tv

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.webkit.*
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var settingsManager: SettingsManager

    companion object {
        private const val TAG = "AniMiraTV"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        settingsManager = SettingsManager(this)
        webView = findViewById(R.id.webView)

        setupWebView()
        loadUrl()

        // Check for updates after a short delay
        checkForUpdatesDelayed()
    }

    private fun checkForUpdatesDelayed() {
        android.os.Handler(mainLooper).postDelayed({
            val updater = Updater(this)
            updater.checkForUpdates(
                onUpdateAvailable = { updateInfo ->
                    updater.showUpdateDialog(
                        updateInfo,
                        onDownload = {
                            updater.downloadAndInstallApk(updateInfo.downloadUrl)
                        }
                    )
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

        // Enable focus for TV navigation
        webView.isFocusable = true
        webView.isFocusableInTouchMode = true
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
        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse(url)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
            Log.d(TAG, "Opened torrent download with external app")
        } catch (e: ActivityNotFoundException) {
            Log.e(TAG, "No app found to handle torrent download")
            Toast.makeText(this, "Нет приложения для скачивания торрентов", Toast.LENGTH_SHORT).show()
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
        Log.d(TAG, "Loading URL: $baseUrl")
        webView.loadUrl(baseUrl)
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
        webView.destroy()
        super.onDestroy()
    }
}
