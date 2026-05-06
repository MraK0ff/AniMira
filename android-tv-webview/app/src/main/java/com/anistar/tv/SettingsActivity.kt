package com.anistar.tv

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity

class SettingsActivity : AppCompatActivity() {

    private lateinit var settingsManager: SettingsManager
    private lateinit var urlInput: EditText
    private lateinit var torrserveInput: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        settingsManager = SettingsManager(this)

        urlInput = findViewById(R.id.urlInput)
        torrserveInput = findViewById(R.id.torrserveInput)
        val saveButton = findViewById<Button>(R.id.saveButton)
        val cancelButton = findViewById<Button>(R.id.cancelButton)

        // Load current settings
        urlInput.setText(settingsManager.getBaseUrl())
        torrserveInput.setText(settingsManager.getTorrServeHost())

        saveButton.setOnClickListener {
            saveSettings()
        }

        cancelButton.setOnClickListener {
            finish()
        }
    }

    private fun saveSettings() {
        val url = urlInput.text.toString().trim()
        val torrserveHost = torrserveInput.text.toString().trim()

        if (url.isNotEmpty()) {
            settingsManager.setBaseUrl(url)
        }

        if (torrserveHost.isNotEmpty()) {
            settingsManager.setTorrServeHost(torrserveHost)
        }

        finish()
    }
}
