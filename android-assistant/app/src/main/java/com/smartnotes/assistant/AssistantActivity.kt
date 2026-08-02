package com.smartnotes.assistant

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.GeolocationPermissions
import android.widget.FrameLayout
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Fullscreen assistant UI utilizing WebView to load the web interface directly.
 * Grants hardware permissions for Audio recording (Microphone) and Location (GPS).
 */
class AssistantActivity : AppCompatActivity() {

    companion object {
        // Change this URL to match your deployment domain or local IP (e.g., http://192.168.1.10:3000)
        private const val BASE_URL = "https://smart-voice-notes.vercel.app"
    }

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // programmatic root layout
        val container = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#090d16"))
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        // Initialize WebView programmatically
        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            webViewClient = WebViewClient()
            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest?) {
                    // Grant audio and other requests automatically
                    request?.grant(request.resources)
                }

                override fun onGeolocationPermissionsShowPrompt(
                    origin: String?,
                    callback: GeolocationPermissions.Callback?
                ) {
                    // Grant location permissions automatically inside the WebView
                    callback?.invoke(origin, true, false)
                }
            }
        }

        // Configure WebView settings
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            databaseEnabled = true
            @Suppress("DEPRECATION")
            setGeolocationEnabled(true)
        }

        container.addView(webView)
        setContentView(container)

        // Request runtime permissions for Audio Record and GPS Geolocation
        checkAndRequestPermissions()

        // Configure Back Button behavior using Modern OnBackPressedDispatcher API
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })

        // Load the appropriate URL based on intent extra
        val loadMainApp = intent.getBooleanExtra("LOAD_MAIN_APP", false)
        val targetUrl = if (loadMainApp) {
            BASE_URL
        } else {
            "$BASE_URL/?tab=assistant"
        }
        webView.loadUrl(targetUrl)
    }

    private fun checkAndRequestPermissions() {
        val permissionsNeeded = mutableListOf<String>()
        
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.RECORD_AUDIO)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }

        if (permissionsNeeded.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissionsNeeded.toTypedArray(), 101)
        }
    }
}
