package com.animira.tv

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class SettingsActivity : AppCompatActivity() {

    private lateinit var settingsManager: SettingsManager
    private lateinit var urlInput: EditText
    private lateinit var versionText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        settingsManager = SettingsManager(this)

        urlInput = findViewById(R.id.urlInput)
        versionText = findViewById(R.id.versionText)
        val saveButton = findViewById<Button>(R.id.saveButton)
        val cancelButton = findViewById<Button>(R.id.cancelButton)
        val checkUpdateButton = findViewById<Button>(R.id.checkUpdateButton)

        // Load current settings
        urlInput.setText(settingsManager.getBaseUrl())
        versionText.text = "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})"

        saveButton.setOnClickListener {
            saveSettings()
        }

        cancelButton.setOnClickListener {
            finish()
        }

        checkUpdateButton.setOnClickListener {
            checkForUpdates()
        }
    }

    private fun saveSettings() {
        val url = urlInput.text.toString().trim()

        if (url.isNotEmpty()) {
            settingsManager.setBaseUrl(url)
        }

        finish()
    }

    private fun checkForUpdates() {
        val updater = Updater(this)
        updater.checkForUpdates(
            onUpdateAvailable = { updateInfo ->
                updater.showUpdateDialog(
                    updateInfo,
                    onDownload = {
                        updater.downloadAndInstallApk(updateInfo.downloadUrl)
                    }
                )
            },
            onNoUpdate = {
                Toast.makeText(this, "Установлена актуальная версия", Toast.LENGTH_SHORT).show()
            },
            onError = { error ->
                Toast.makeText(this, "Ошибка проверки: $error", Toast.LENGTH_SHORT).show()
            }
        )
    }
}
