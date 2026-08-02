package com.smartnotes.assistant

import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/**
 * MainActivity programmatically rendered to guide the user to configure
 * default digital assistant settings in Android.
 */
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val rootLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#090d16"))
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setPadding(50, 50, 50, 50)
        }

        val titleText = TextView(this).apply {
            text = "SmartNotes Assistant"
            setTextColor(Color.WHITE)
            textSize = 24f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(0, 0, 0, 40)
            }
        }

        val descText = TextView(this).apply {
            text = "Agar aplikasi ini dapat mendengarkan tombol fisik (seperti menahan tombol Power/Home/Volume), Anda harus menyetelnya sebagai Aplikasi Asisten Digital utama di sistem Android."
            setTextColor(Color.parseColor("#94a3b8"))
            textSize = 15f
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(0, 0, 0, 60)
            }
        }

        val settingsButton = Button(this).apply {
            text = "Buka Pengaturan Asisten HP"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#4f46e5"))
            setPadding(30, 20, 30, 20)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(0, 0, 0, 30)
            }
            setOnClickListener {
                try {
                    val intent = Intent(Settings.ACTION_VOICE_INPUT_SETTINGS)
                    startActivity(intent)
                } catch (e: Exception) {
                    try {
                        val intent = Intent(Settings.ACTION_ASSIST_WRITE_SETTINGS)
                        startActivity(intent)
                    } catch (e2: Exception) {
                        Toast.makeText(
                            this@MainActivity,
                            "Gagal membuka pengaturan secara otomatis. Silakan buka Pengaturan HP > Aplikasi > Aplikasi Default > Asisten.",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            }
        }

        val pwaButton = Button(this).apply {
            text = "Buka Aplikasi Utama (PWA)"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#1e293b"))
            setPadding(30, 20, 30, 20)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            setOnClickListener {
                val intent = Intent(this@MainActivity, AssistantActivity::class.java).apply {
                    putExtra("LOAD_MAIN_APP", true)
                }
                startActivity(intent)
            }
        }

        rootLayout.addView(titleText)
        rootLayout.addView(descText)
        rootLayout.addView(settingsButton)
        rootLayout.addView(pwaButton)

        setContentView(rootLayout)
    }
}
