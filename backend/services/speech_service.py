from google.cloud import speech
import structlog
import io

logger = structlog.get_logger()

try:
    client = speech.SpeechClient()
except Exception as e:
    logger.warning("speech_client_init_failed", error=str(e))
    client = None


class SpeechService:
    """Cloud Speech-to-Text using chirp_2 model for Marathi/Hindi."""

    SUPPORTED_LANGUAGES = {
        "mr": "mr-IN",  # Marathi
        "hi": "hi-IN",  # Hindi
        "en": "en-IN",  # English (Indian)
    }

    @staticmethod
    def transcribe(audio_content: bytes, language: str = "mr") -> str:
        """
        Transcribe audio bytes to text.
        
        Args:
            audio_content: Raw audio bytes (WebM/Opus from browser MediaRecorder)
            language: Language code key ('mr', 'hi', 'en')
            
        Returns:
            Transcribed text string
        """
        if client is None:
            raise RuntimeError("Speech client not initialized")

        language_code = SpeechService.SUPPORTED_LANGUAGES.get(language, "mr-IN")

        try:
            audio = speech.RecognitionAudio(content=audio_content)
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
                sample_rate_hertz=48000,
                language_code=language_code,
                model="chirp_2",
                alternative_language_codes=["hi-IN"],
                enable_automatic_punctuation=True,
                audio_channel_count=1,
            )

            response = client.recognize(config=config, audio=audio)

            transcript_parts = []
            for result in response.results:
                if result.alternatives:
                    transcript_parts.append(result.alternatives[0].transcript)

            transcript = " ".join(transcript_parts).strip()
            logger.info(
                "speech_transcription_success",
                language=language_code,
                length=len(transcript),
            )
            return transcript

        except Exception as e:
            logger.error("speech_to_text_error", error=str(e), language=language_code)
            raise


    @staticmethod
    def transcribe_long(audio_content: bytes, language: str = "mr") -> str:
        """
        For audio > 1 minute, use long running recognize.
        Falls back to short transcribe if audio is small.
        """
        if len(audio_content) < 1_000_000:  # ~1MB roughly < 1 min
            return SpeechService.transcribe(audio_content, language)

        if client is None:
            raise RuntimeError("Speech client not initialized")

        language_code = SpeechService.SUPPORTED_LANGUAGES.get(language, "mr-IN")

        try:
            audio = speech.RecognitionAudio(content=audio_content)
            config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
                sample_rate_hertz=48000,
                language_code=language_code,
                model="chirp_2",
                alternative_language_codes=["hi-IN"],
                enable_automatic_punctuation=True,
                audio_channel_count=1,
            )

            operation = client.long_running_recognize(config=config, audio=audio)
            response = operation.result(timeout=120)

            transcript_parts = []
            for result in response.results:
                if result.alternatives:
                    transcript_parts.append(result.alternatives[0].transcript)

            return " ".join(transcript_parts).strip()

        except Exception as e:
            logger.error("long_transcription_error", error=str(e))
            raise
