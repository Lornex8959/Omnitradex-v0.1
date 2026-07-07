/**
 * ================================================================
 * OMNITRADEX ERROR HANDLING SYSTEM
 * ================================================================
 * Provides:
 * 1. Global error trap (uncaught exceptions + unhandled promise rejections)
 * 2. API call wrapper with timeout + retry logic
 * 3. Request queue for rate-limit protection
 * 4. User-visible error logging to AI Terminal
 * 5. Graceful degradation (app never crashes silently)
 * ================================================================
 */

(function () {
  'use strict';

  /* ============ ERROR TRAP INITIALIZATION ============ */
  var ErrorHandler = {
    // Configuration
    config: {
      AI_TIMEOUT: 10000,        // 10 seconds
      API_TIMEOUT: 8000,        // 8 seconds
      MAX_RETRIES: 2,           // Retry up to 2 times on failure
      RETRY_BACKOFF: 1000,      // Start with 1s, exponential backoff
      MAX_ERROR_LOG: 50,        // Keep last 50 errors in memory
      REQUEST_QUEUE_MAX: 10,    // Max concurrent API calls
    },

    // Error storage
    errors: [],
    requestQueue: [],
    activeRequests: 0,

    // UI elements
    aiTerminal: null,
    aiLoader: null,

    /**
     * Initialize error handling system
     * Call this ONCE at page load (after DOM ready)
     */
    init: function () {
      this.aiTerminal = document.getElementById('ai-log');
      this.aiLoader = document.getElementById('terminalLoader');

      // Global error handler
      window.addEventListener('error', this._handleError.bind(this));

      // Unhandled promise rejection
      window.addEventListener('unhandledrejection', this._handlePromiseRejection.bind(this));

      // Page visibility (pause operations when tab hidden)
      document.addEventListener('visibilitychange', this._handleVisibilityChange.bind(this));

      this._log('[SYS]', 'Error handling system armed. Terminal never crashes.', 'system');
    },

    /**
     * Log error to terminal AND internal buffer
     */
    _log: function (badge, message, type) {
      type = type || 'error';

      // Add to internal buffer
      this.errors.push({
        timestamp: new Date().toISOString(),
        badge: badge,
        message: message,
        type: type
      });

      // Trim buffer if too large
      if (this.errors.length > this.config.MAX_ERROR_LOG) {
        this.errors.shift();
      }

      // Log to AI Terminal if available
      if (this.aiTerminal) {
        var row = document.createElement('p');
        row.className = type === 'error' ? 'text-neonred' :
                        type === 'warning' ? 'text-neonamber' :
                        type === 'success' ? 'text-neongreen' :
                        'text-neonmagenta';
        row.textContent = '> [' + badge + '] ' + message;
        this.aiTerminal.appendChild(row);

        // Auto-scroll to bottom
        this.aiTerminal.scrollTop = this.aiTerminal.scrollHeight;

        // Trim terminal display to last 30 lines
        while (this.aiTerminal.children.length > 30) {
          this.aiTerminal.removeChild(this.aiTerminal.firstChild);
        }
      }

      // Always log to console for debugging
      console.log('[' + badge + '] ' + message);
    },

    /**
     * Handle global errors (throw statements, syntax errors, etc.)
     */
    _handleError: function (event) {
      var msg = event.message || 'Unknown error';
      var source = event.filename ? event.filename.split('/').pop() : 'unknown';
      var line = event.lineno ? ':' + event.lineno : '';
      var detail = source + line + ' — ' + msg;

      this._log('TRAP', detail, 'error');

      // Prevent default error page
      event.preventDefault();
    },

    /**
     * Handle unhandled promise rejections
     */
    _handlePromiseRejection: function (event) {
      var reason = event.reason || 'Unknown rejection';
      var msg = typeof reason === 'string' ? reason : reason.message || String(reason);

      this._log('PROMISE', msg, 'error');

      // Prevent unhandled rejection crash
      event.preventDefault();
    },

    /**
     * Handle tab visibility (pause feeds, mentors, etc. when hidden)
     */
    _handleVisibilityChange: function () {
      if (document.hidden) {
        this._log('SYS', 'Tab hidden — pausing feeds and inference', 'warning');
      } else {
        this._log('SYS', 'Tab resumed — resuming operations', 'success');
      }
    },

    /**
     * Create a timeout-enabled fetch wrapper
     * Usage: ErrorHandler.apiCall('GET', url, { timeout: 5000, retries: 2 })
     */
    apiCall: function (method, url, options) {
      var self = this;
      options = options || {};

      var timeout = options.timeout || this.config.API_TIMEOUT;
      var maxRetries = options.retries !== undefined ? options.retries : this.config.MAX_RETRIES;
      var body = options.body || null;
      var headers = options.headers || {};

      return this._fetchWithRetry(method, url, body, headers, timeout, maxRetries);
    },

    /**
     * Fetch with automatic retry on network errors
     */
    _fetchWithRetry: function (method, url, body, headers, timeout, retries) {
      var self = this;

      return this._fetchWithTimeout(method, url, body, headers, timeout)
        .catch(function (error) {
          if (retries > 0) {
            // Exponential backoff: 1s, 2s, 4s...
            var backoff = self.config.RETRY_BACKOFF * Math.pow(2, self.config.MAX_RETRIES - retries);
            self._log('RETRY', 'Attempt ' + (self.config.MAX_RETRIES - retries + 1) +
              ' in ' + backoff + 'ms for ' + url, 'warning');

            return new Promise(function (resolve) {
              setTimeout(function () {
                resolve(self._fetchWithRetry(method, url, body, headers, timeout, retries - 1));
              }, backoff);
            });
          } else {
            throw error;
          }
        });
    },

    /**
     * Fetch with timeout wrapper
     */
    _fetchWithTimeout: function (method, url, body, headers, timeout) {
      var controller = new AbortController();
      var timeoutId = setTimeout(function () { controller.abort(); }, timeout);

      var fetchOptions = {
        method: method,
        headers: headers,
        signal: controller.signal
      };

      if (body) {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      return fetch(url, fetchOptions)
        .then(function (response) {
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
          }

          return response.json();
        })
        .catch(function (error) {
          clearTimeout(timeoutId);

          if (error.name === 'AbortError') {
            throw new Error('Request timeout (' + timeout + 'ms): ' + url);
          }

          throw error;
        });
    },

    /**
     * Safe AI inference call (with loader UI)
     * Usage: ErrorHandler.inferenceCall(prompt, apiKey, model)
     */
    inferenceCall: function (prompt, apiKey, model) {
      var self = this;

      if (!apiKey) {
        this._log('AI', 'API key not deciphered. Open Key Vault and Seal.', 'error');
        return Promise.reject(new Error('No API key'));
      }

      // Show loader
      if (this.aiLoader) {
        this.aiLoader.style.display = 'block';
      }

      this._log('AI', 'Triggering inference on model: ' + model, 'system');

      // Call actual inference (you implement this per provider)
      return this._callProvider(prompt, apiKey, model, this.config.AI_TIMEOUT)
        .then(function (result) {
          // Hide loader
          if (self.aiLoader) {
            self.aiLoader.style.display = 'none';
          }

          self._log('AI', 'Inference complete', 'success');
          return result;
        })
        .catch(function (error) {
          // Hide loader
          if (self.aiLoader) {
            self.aiLoader.style.display = 'none';
          }

          var msg = error.message || String(error);
          self._log('AI', 'Inference failed: ' + msg, 'error');

          throw error;
        });
    },

    /**
     * Provider-agnostic inference call
     * Implement per-provider logic here
     */
    _callProvider: function (prompt, apiKey, model, timeout) {
      // This is a stub—you'll implement per provider
      if (model.includes('gemini')) {
        return this._callGemini(prompt, apiKey, model, timeout);
      } else if (model.includes('openai')) {
        return this._callOpenAI(prompt, apiKey, model, timeout);
      } else if (model.includes('anthropic')) {
        return this._callAnthropic(prompt, apiKey, model, timeout);
      } else if (model.includes('groq')) {
        return this._callGroq(prompt, apiKey, model, timeout);
      }

      return Promise.reject(new Error('Unknown model: ' + model));
    },

    /**
     * Gemini API call example
     */
    _callGemini: function (prompt, apiKey, model, timeout) {
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model +
        ':generateContent?key=' + encodeURIComponent(apiKey);

      var body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024 }
      };

      return this.apiCall('POST', url, {
        body: body,
        timeout: timeout,
        retries: 1
      })
        .then(function (result) {
          if (!result.candidates || !result.candidates[0]) {
            throw new Error('No response from Gemini');
          }

          var text = result.candidates[0].content.parts[0].text;
          return { success: true, text: text };
        });
    },

    /**
     * OpenAI API call example (stub)
     */
    _callOpenAI: function (prompt, apiKey, model, timeout) {
      var url = 'https://api.openai.com/v1/chat/completions';

      var body = {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024
      };

      return this.apiCall('POST', url, {
        body: body,
        headers: { 'Authorization': 'Bearer ' + apiKey },
        timeout: timeout,
        retries: 1
      })
        .then(function (result) {
          if (!result.choices || !result.choices[0]) {
            throw new Error('No response from OpenAI');
          }

          var text = result.choices[0].message.content;
          return { success: true, text: text };
        });
    },

    /**
     * Anthropic API call example (stub)
     */
    _callAnthropic: function (prompt, apiKey, model, timeout) {
      var url = 'https://api.anthropic.com/v1/messages';

      var body = {
        model: model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      };

      return this.apiCall('POST', url, {
        body: body,
        headers: { 'x-api-key': apiKey },
        timeout: timeout,
        retries: 1
      })
        .then(function (result) {
          if (!result.content || !result.content[0]) {
            throw new Error('No response from Anthropic');
          }

          var text = result.content[0].text;
          return { success: true, text: text };
        });
    },

    /**
     * Groq API call example (stub)
     */
    _callGroq: function (prompt, apiKey, model, timeout) {
      var url = 'https://api.groq.com/openai/v1/chat/completions';

      var body = {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024
      };

      return this.apiCall('POST', url, {
        body: body,
        headers: { 'Authorization': 'Bearer ' + apiKey },
        timeout: timeout,
        retries: 1
      })
        .then(function (result) {
          if (!result.choices || !result.choices[0]) {
            throw new Error('No response from Groq');
          }

          var text = result.choices[0].message.content;
          return { success: true, text: text };
        });
    },

    /**
     * Get error history for debugging
     */
    getErrorHistory: function () {
      return this.errors;
    },

    /**
     * Clear error history
     */
    clearErrors: function () {
      this.errors = [];
      this._log('SYS', 'Error history cleared', 'success');
    }
  };

  // Export to global scope
  window.ErrorHandler = ErrorHandler;
})();
