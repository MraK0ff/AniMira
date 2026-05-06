package com.anistar.tv

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.webkit.*
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var settingsManager: SettingsManager
    private var isMenuVisible = false

    companion object {
        private const val TAG = "AnistarTV"
        private const val TORRSERVE_SCHEME = "torrserve"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        settingsManager = SettingsManager(this)
        webView = findViewById(R.id.webView)

        setupWebView()
        loadUrl()
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

        // Enable focus for TV navigation
        webView.isFocusable = true
        webView.isFocusableInTouchMode = true
    }

    private fun handleUrl(url: String): Boolean {
        val uri = Uri.parse(url)

        // Handle TorrServe links
        if (isTorrServeUrl(uri)) {
            handleTorrServeLink(url)
            return true
        }

        // Handle intent:// URLs
        if (uri.scheme == "intent") {
            return handleIntentUrl(url)
        }

        return false
    }

    private fun isTorrServeUrl(uri: Uri): Boolean {
        val torrserveHost = settingsManager.getTorrServeHost()
        val host = torrserveHost.split(":")[0]
        val port = torrserveHost.split(":").getOrNull(1)?.toIntOrNull() ?: 8090

        return (uri.scheme == "http" || uri.scheme == "https") &&
               (uri.host == host || uri.host == "127.0.0.1" || uri.host == "localhost") &&
               uri.port == port
    }

    private fun handleTorrServeLink(url: String) {
        val uri = Uri.parse(url)
        val torrserveUri = uri.buildUpon()
            .scheme(TORRSERVE_SCHEME)
            .authority("play")
            .build()

        val intent = Intent(Intent.ACTION_VIEW, torrserveUri).apply {
            setPackage("com.torrserve")
            putExtra("link", url)
        }

        try {
            startActivity(intent)
            Log.d(TAG, "Launched TorrServe with link: $url")
        } catch (e: ActivityNotFoundException) {
            // Try alternative TorrServe package names
            tryAlternativeTorrServe(url)
        }
    }

    private fun tryAlternativeTorrServe(url: String) {
        val alternativePackages = listOf(
            "yourok.torrserve",
            "ru.yourok.torrserve",
            "com.torrserve.android"
        )

        for (packageName in alternativePackages) {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                    setPackage(packageName)
                }
                startActivity(intent)
                Log.d(TAG, "Launched TorrServe ($packageName) with link: $url")
                return
            } catch (e: ActivityNotFoundException) {
                continue
            }
        }

        // No TorrServe app found, show dialog
        showTorrServeNotInstalledDialog(url)
    }

    private fun showTorrServeNotInstalledDialog(url: String) {
        AlertDialog.Builder(this)
            .setTitle(R.string.torrserve_not_found_title)
            .setMessage(R.string.torrserve_not_found_message)
            .setPositiveButton(R.string.download) { _, _ ->
                openTorrServeDownloadPage()
            }
            .setNegativeButton(R.string.copy_link) { _, _ ->
                copyToClipboard(url)
                Toast.makeText(this, R.string.link_copied, Toast.LENGTH_SHORT).show()
            }
            .setNeutralButton(R.string.cancel, null)
            .show()
    }

    private fun openTorrServeDownloadPage() {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/YouROK/TorrServe"))
        startActivity(intent)
    }

    private fun copyToClipboard(text: String) {
        val clipboard = getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager
        val clip = android.content.ClipData.newPlainText("TorrServe Link", text)
        clipboard.setPrimaryClip(clip)
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
                
                // Improve keyboard navigation
                document.addEventListener('keydown', function(e) {
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || 
                        e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                        // Let default handling work for D-pad
                    }
                });
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
