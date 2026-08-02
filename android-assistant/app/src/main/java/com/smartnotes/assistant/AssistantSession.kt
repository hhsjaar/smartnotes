package com.smartnotes.assistant

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.service.voice.VoiceInteractionSession

/**
 * Manages the VoiceInteractionSession lifecycle.
 * Launches the AssistantActivity when invoked and closes the overlay.
 */
class AssistantSession(context: Context) : VoiceInteractionSession(context) {

    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)

        // Launch our full WebView assistant activity on top
        val intent = Intent(context, AssistantActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        context.startActivity(intent)

        // Terminate the background session window immediately
        finish()
    }
}
