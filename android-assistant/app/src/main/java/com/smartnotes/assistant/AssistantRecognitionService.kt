package com.smartnotes.assistant

import android.speech.RecognitionService
import android.content.Intent

/**
 * Placeholder recognition service to satisfy Android Assistant configuration requirements.
 */
class AssistantRecognitionService : RecognitionService() {
    override fun onStartListening(intent: Intent?, listener: Callback?) {}
    override fun onCancel(listener: Callback?) {}
    override fun onStopListening(listener: Callback?) {}
}
