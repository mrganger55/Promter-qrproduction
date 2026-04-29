/* ============================================
   QR Production Prompter — Display Engine
   ============================================
   Runs on the SECOND SCREEN (artist's stage display).
   Communicates with control panel via BroadcastChannel.

   Features:
   - Auto-fit pagination with per-page optimal font sizing
   - Fade transitions between pages
   - Chronometer (synced or independent)
   - Song info + next song display
   - Message overlay
   - Reading guide line
   - Countdown overlay
   - Keyboard, mouse, wheel navigation
   - Themes, mirror mode, section colors
   - Cursor auto-hide
   ============================================ */
(function () {
    'use strict';

    // ============================================================
    //  BROADCAST CHANNEL
    // ============================================================
    const ch = new BroadcastChannel('qr-prompter');
    const $ = function (s) { return document.querySelector(s); };

    // ============================================================
    //  DOM REFERENCES
    //  Some elements may not exist in HTML; we create them dynamically.
    // ============================================================
    function ensureElement(id, tag, className, parentSelector, attrs) {
        var el = document.getElementById(id);
        if (el) return el;
        el = document.createElement(tag || 'div');
        el.id = id;
        if (className) el.className = className;
        if (attrs) {
            for (var k in attrs) el.setAttribute(k, attrs[k]);
        }
        var parent = parentSelector ? $(parentSelector) : document.body;
        if (parent) parent.appendChild(el);
        return el;
    }

    var dom = {
        body:       document.body,
        cdOverlay:  $('#cdOverlay'),
        cdNum:      $('#cdNum'),
        guideLine:  $('#guideLine'),
        pageArea:   $('#pageArea'),
        pageBox:    $('#pageBox'),
        dots:       $('#dots'),
        ibSong:     $('#ibSong'),
        ibPage:     $('#ibPage'),
        ibClock:    $('#ibClock'),
        hint:       $('#hint'),
        measurer:   $('#measurer')
    };

    // Ensure elements that may be missing from HTML
    dom.ibKey     = ensureElement('ibKey', 'span', 'ib-key', null);
    dom.ibChrono  = ensureElement('ibChrono', 'span', 'ib-chrono', null);
    dom.nextSongInfo = ensureElement('nextSongInfo', 'div', 'next-song-info', null);
    dom.msgOverlay   = ensureElement('msgOverlay', 'div', 'msg-overlay', null);
    dom.msgText      = ensureElement('msgText', 'div', 'msg-text', '#msgOverlay');

    // Insert ibKey and ibChrono into info bar if they were created dynamically
    (function placeInfoBarElements() {
        var ibCenter = $('.ib-center');
        if (ibCenter) {
            // Place key after song title
            if (dom.ibKey && !dom.ibKey.parentElement.classList.contains('ib-center')) {
                var sep = document.createElement('span');
                sep.className = 'ib-sep';
                sep.textContent = '|';
                ibCenter.insertBefore(sep, dom.ibPage);
                ibCenter.insertBefore(dom.ibKey, sep);
            }
            // Place chrono after page
            if (dom.ibChrono && !dom.ibChrono.parentElement.classList.contains('ib-center')) {
                var sep2 = document.createElement('span');
                sep2.className = 'ib-sep';
                sep2.textContent = '|';
                ibCenter.appendChild(sep2);
                ibCenter.appendChild(dom.ibChrono);
            }
        }
    })();

    // ============================================================
    //  STATE
    // ============================================================
    var pages       = [];          // Array of { lines, fontSize }
    var currentPage = 0;
    var totalPages  = 0;
    var allLines    = [];          // Parsed line objects
    var fontMin     = 32;
    var fontMax     = 72;
    var cursorTimer = null;

    // Chronometer state
    var chronoElapsed = 0;         // elapsed seconds
    var chronoRunning = false;
    var chronoInterval = null;
    var chronoLastSync = 0;        // performance.now() of last sync

    var SECTION_RE = /^\[(VERSE|CHORUS|BRIDGE|INTRO|OUTRO|SOLO|BREAK|NOTE)\]$/i;

    // ============================================================
    //  UTILITY
    // ============================================================
    function esc(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function formatTime(totalSec) {
        var h = Math.floor(totalSec / 3600);
        var m = Math.floor((totalSec % 3600) / 60);
        var s = Math.floor(totalSec % 60);
        return String(h).padStart(2, '0') + ':' +
               String(m).padStart(2, '0') + ':' +
               String(s).padStart(2, '0');
    }

    // ============================================================
    //  CLOCK (updates every second in info bar)
    // ============================================================
    setInterval(function () {
        if (dom.ibClock) {
            dom.ibClock.textContent = new Date().toLocaleTimeString('tr-TR', { hour12: false });
        }
    }, 1000);

    // ============================================================
    //  CHRONOMETER
    // ============================================================
    function updateChronoDisplay() {
        if (dom.ibChrono) {
            dom.ibChrono.textContent = formatTime(chronoElapsed);
        }
    }

    function startChronoTick() {
        if (chronoInterval) return;
        chronoLastSync = performance.now();
        chronoInterval = setInterval(function () {
            if (chronoRunning) {
                var now = performance.now();
                chronoElapsed += (now - chronoLastSync) / 1000;
                chronoLastSync = now;
                updateChronoDisplay();
            }
        }, 250);
    }

    function stopChronoTick() {
        if (chronoInterval) {
            clearInterval(chronoInterval);
            chronoInterval = null;
        }
    }

    function syncChrono(elapsed, running) {
        chronoElapsed = elapsed;
        chronoRunning = running;
        chronoLastSync = performance.now();
        updateChronoDisplay();
        if (running) {
            startChronoTick();
        } else {
            stopChronoTick();
        }
    }

    // Initialize chrono display
    updateChronoDisplay();

    // ============================================================
    //  CURSOR AUTO-HIDE (3 seconds of no movement)
    // ============================================================
    document.addEventListener('mousemove', function () {
        dom.body.classList.add('show-cursor');
        clearTimeout(cursorTimer);
        cursorTimer = setTimeout(function () {
            dom.body.classList.remove('show-cursor');
        }, 3000);
    });

    // ============================================================
    //  HINT (show for 5 seconds on load)
    // ============================================================
    setTimeout(function () {
        if (dom.hint) dom.hint.classList.add('off');
    }, 5000);

    // ============================================================
    //  FULLSCREEN
    // ============================================================
    function toggleFS() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(function () {});
        } else {
            document.exitFullscreen().catch(function () {});
        }
    }
    document.addEventListener('dblclick', toggleFS);

    // ============================================================
    //  GUIDE LINE ARROWS
    // ============================================================
    (function initGuideArrows() {
        if (!dom.guideLine) return;
        var al = document.createElement('span');
        al.className = 'guide-arrow-l';
        var ar = document.createElement('span');
        ar.className = 'guide-arrow-r';
        dom.guideLine.appendChild(al);
        dom.guideLine.appendChild(ar);
    })();

    // ============================================================
    //  TEXT PARSING
    // ============================================================
    /**
     * Parse raw text into an array of line objects.
     * Each object: { type: 'line'|'section'|'empty', text, sectionClass }
     */
    function parseLines(rawText) {
        return rawText.split('\n').map(function (line) {
            var t = line.trim();
            var m = t.match(SECTION_RE);
            if (m) return { type: 'section', text: t, sectionClass: m[1].toLowerCase() };
            if (t === '') return { type: 'empty', text: '' };
            return { type: 'line', text: t };
        });
    }

    // ============================================================
    //  AUTO-FIT PAGINATION ENGINE
    //
    //  The most critical feature. For each page:
    //  1. Start with remaining lines
    //  2. Try to fit as many lines as possible
    //  3. For candidate line count, binary search max font size
    //  4. If even at fontMin it doesn't fit, reduce line count
    //  5. Store page: { lines, fontSize }
    // ============================================================

    /** Available height for text content (page area minus padding). */
    function getAvailableHeight() {
        return dom.pageArea.clientHeight - 60; // 30px top + 30px bottom padding
    }

    /** Available width for text measurement. */
    function getAvailableWidth() {
        return dom.pageArea.clientWidth * 0.9; // 5% padding each side
    }

    /**
     * Measure the rendered height of a block of lines at a given font size.
     * Uses the hidden #measurer div for accurate measurement.
     *
     * - Normal lines: font-size, line-height:1.7, word-wrap:break-word
     * - Section markers: 35% of main font size, uppercase, letter-spacing
     * - Empty lines: height = fontSize * 0.3
     */
    function measureBlock(lines, fontSize) {
        var m = dom.measurer;
        m.style.width = getAvailableWidth() + 'px';

        var html = '';
        for (var i = 0; i < lines.length; i++) {
            var ln = lines[i];
            if (ln.type === 'section') {
                var secSize = Math.max(14, Math.round(fontSize * 0.35));
                html += '<div class="section-marker" style="font-size:' + secSize + 'px;font-weight:700;text-transform:uppercase;letter-spacing:4px;padding:' + Math.round(fontSize * 0.15) + 'px 0 ' + Math.round(fontSize * 0.06) + 'px">' + esc(ln.text) + '</div>';
            } else if (ln.type === 'empty') {
                html += '<div class="line empty" style="height:' + Math.round(fontSize * 0.3) + 'px"></div>';
            } else {
                html += '<div class="line" style="font-size:' + fontSize + 'px;line-height:1.7;font-weight:500;word-wrap:break-word;overflow-wrap:break-word;padding:2px 0">' + esc(ln.text) + '</div>';
            }
        }
        m.innerHTML = html;
        return m.scrollHeight;
    }

    /**
     * Core pagination algorithm.
     * Splits allLines into pages, each with its own optimal font size.
     */
    function paginate() {
        if (!allLines.length) {
            pages = [];
            totalPages = 0;
            currentPage = 0;
            renderDots();
            return;
        }

        var availH = getAvailableHeight();
        pages = [];

        // Work on a copy; trim leading/trailing empty lines
        var lines = allLines.slice();
        while (lines.length && lines[0].type === 'empty') lines.shift();
        while (lines.length && lines[lines.length - 1].type === 'empty') lines.pop();

        var cursor = 0;

        while (cursor < lines.length) {
            var bestPageEnd = cursor + 1;
            var bestFontSize = fontMax;
            var found = false;

            // Try fitting as many lines as possible (greedy), then binary search font
            for (var end = lines.length; end > cursor; end--) {
                var slice = lines.slice(cursor, end);

                // Skip slices that are only empties
                var allEmpty = true;
                for (var k = 0; k < slice.length; k++) {
                    if (slice[k].type !== 'empty') { allEmpty = false; break; }
                }
                if (allEmpty) continue;

                // Quick check: does it fit at minimum font?
                var hMin = measureBlock(slice, fontMin);
                if (hMin > availH) continue; // too many lines even at min font

                // Binary search for maximum font size that fits
                var lo = fontMin;
                var hi = fontMax;
                var fitFont = 0;

                while (lo <= hi) {
                    var mid = Math.round((lo + hi) / 2);
                    var h = measureBlock(slice, mid);
                    if (h <= availH) {
                        fitFont = mid;
                        lo = mid + 1;
                    } else {
                        hi = mid - 1;
                    }
                }

                if (fitFont >= fontMin) {
                    bestPageEnd = end;
                    bestFontSize = fitFont;
                    found = true;
                    break; // Take the maximum lines that fit
                }
            }

            if (!found) {
                // Fallback: force at least one line per page at min font
                bestPageEnd = cursor + 1;
                bestFontSize = fontMin;
            }

            var pageLines = lines.slice(cursor, bestPageEnd);

            // Trim empties from page edges
            while (pageLines.length && pageLines[0].type === 'empty') {
                pageLines.shift();
                cursor++;
            }
            while (pageLines.length && pageLines[pageLines.length - 1].type === 'empty') {
                pageLines.pop();
                bestPageEnd--;
            }

            if (pageLines.length === 0) {
                cursor++;
                continue;
            }

            pages.push({
                lines: pageLines,
                fontSize: bestFontSize
            });

            cursor = bestPageEnd;

            // Skip empties between pages
            while (cursor < lines.length && lines[cursor].type === 'empty') cursor++;
        }

        totalPages = pages.length;
        if (currentPage >= totalPages) currentPage = Math.max(0, totalPages - 1);

        renderDots();
        reportPages();
    }

    // ============================================================
    //  PAGE RENDERING
    // ============================================================

    /**
     * Display a page by index with optional fade transition.
     * Fade out: 200ms, fade in: 250ms.
     */
    function renderPage(index, animate) {
        if (index < 0 || index >= totalPages) return;
        currentPage = index;

        var page = pages[currentPage];

        if (animate) {
            dom.pageBox.classList.add('out');
            setTimeout(function () {
                applyPage(page);
                dom.pageBox.classList.remove('out');
                dom.pageBox.classList.add('in');
                setTimeout(function () {
                    dom.pageBox.classList.remove('in');
                }, 260);
            }, 200);
        } else {
            applyPage(page);
        }

        // Update info bar
        dom.ibPage.textContent = 'Sayfa ' + (currentPage + 1) + ' / ' + totalPages;
        renderDots();
        reportCurrentPage();
    }

    /**
     * Apply page content to the page box, using the page's optimal font size.
     */
    function applyPage(page) {
        var html = '';
        var fs = page.fontSize;

        for (var i = 0; i < page.lines.length; i++) {
            var ln = page.lines[i];
            if (ln.type === 'section') {
                var secSize = Math.max(14, Math.round(fs * 0.35));
                html += '<div class="section-marker ' + ln.sectionClass + '" style="font-size:' + secSize + 'px">' + esc(ln.text) + '</div>';
            } else if (ln.type === 'empty') {
                html += '<div class="line empty" style="height:' + Math.round(fs * 0.3) + 'px"></div>';
            } else {
                html += '<div class="line" style="font-size:' + fs + 'px;line-height:1.7">' + esc(ln.text) + '</div>';
            }
        }

        dom.pageBox.innerHTML = html;
    }

    /**
     * Render page dots on right side (max 30 dots).
     */
    function renderDots() {
        if (totalPages <= 1) {
            dom.dots.innerHTML = '';
            return;
        }
        var max = Math.min(totalPages, 30);
        var h = '';
        for (var i = 0; i < max; i++) {
            h += '<div class="dot ' + (i === currentPage ? 'on' : '') + '"></div>';
        }
        dom.dots.innerHTML = h;
    }

    // ============================================================
    //  SONG INFO
    // ============================================================

    /**
     * Update song title and key in the info bar.
     */
    function updateSongInfo(title, key) {
        if (dom.ibSong) dom.ibSong.textContent = title || '\u2014';
        if (dom.ibKey)  dom.ibKey.textContent  = key   || '';
    }

    /**
     * Update "next song" display near bottom.
     * Format: "Siradaki: [title] -- [key]"
     */
    function updateNextSong(nextTitle, nextKey) {
        if (!dom.nextSongInfo) return;
        if (!nextTitle) {
            dom.nextSongInfo.textContent = '';
            dom.nextSongInfo.classList.remove('visible');
            return;
        }
        var text = 'S\u0131radaki: ' + nextTitle;
        if (nextKey) text += ' \u2014 ' + nextKey;
        dom.nextSongInfo.textContent = text;
        dom.nextSongInfo.classList.add('visible');
    }

    // ============================================================
    //  MESSAGE OVERLAY
    // ============================================================
    var msgTimer = null;

    /**
     * Show a semi-transparent message overlay.
     * Auto-fades after duration seconds.
     */
    function showMessage(text, duration) {
        if (!dom.msgOverlay || !dom.msgText) return;
        clearTimeout(msgTimer);

        dom.msgText.textContent = text;
        dom.msgOverlay.classList.add('visible');

        var dur = (duration || 5) * 1000;
        msgTimer = setTimeout(function () {
            dom.msgOverlay.classList.remove('visible');
        }, dur);
    }

    // ============================================================
    //  COUNTDOWN OVERLAY
    // ============================================================
    function countdown(sec) {
        if (!dom.cdOverlay || !dom.cdNum) return;
        dom.cdOverlay.classList.add('on');
        var r = sec;
        dom.cdNum.textContent = r;
        var iv = setInterval(function () {
            r--;
            if (r <= 0) {
                clearInterval(iv);
                dom.cdOverlay.classList.remove('on');
            } else {
                dom.cdNum.textContent = r;
            }
        }, 1000);
    }

    // ============================================================
    //  VISUAL SETTINGS
    // ============================================================

    /**
     * Apply settings received from control panel.
     * Handles: theme, mirror, section colors, guide line, font bounds.
     */
    function applySettings(s) {
        if (s.mirrorMode !== undefined) {
            dom.body.classList.toggle('mirror', s.mirrorMode);
        }
        if (s.sectionColors !== undefined) {
            dom.body.classList.toggle('no-section-colors', !s.sectionColors);
        }
        if (s.theme !== undefined) {
            dom.body.classList.remove('theme-light', 'theme-high-contrast');
            if (s.theme === 'light')         dom.body.classList.add('theme-light');
            else if (s.theme === 'high-contrast') dom.body.classList.add('theme-high-contrast');
        }
        if (s.guideVisible !== undefined && dom.guideLine) {
            dom.guideLine.classList.toggle('hidden', !s.guideVisible);
        }
        if (s.guidePos !== undefined && dom.guideLine) {
            dom.guideLine.style.setProperty('--guide-top', s.guidePos + '%');
        }
        if (s.guideWidth !== undefined && dom.guideLine) {
            dom.guideLine.style.setProperty('--guide-width', s.guideWidth + 'px');
        }
        if (s.guideColor !== undefined && dom.guideLine) {
            dom.guideLine.style.setProperty('--guide-color', s.guideColor);
        }
        if (s.fontMin !== undefined) fontMin = s.fontMin;
        if (s.fontMax !== undefined) fontMax = s.fontMax;
    }

    // ============================================================
    //  CONTROL PANEL COMMUNICATION
    // ============================================================

    /** Notify control panel that pages are ready. */
    function reportPages() {
        ch.postMessage({
            type: 'pagesReady',
            data: { total: totalPages, current: currentPage + 1 }
        });
    }

    /** Notify control panel of current page change. */
    function reportCurrentPage() {
        ch.postMessage({
            type: 'pageChanged',
            data: { page: currentPage + 1, total: totalPages }
        });
    }

    // ---- Receive messages from control panel ----
    ch.onmessage = function (evt) {
        var msg  = evt.data;
        var type = msg.type;
        var data = msg.data || {};

        switch (type) {

            // Initial settings from control panel
            case 'init':
                applySettings(data);
                break;

            // Load new song text and repaginate
            case 'loadText':
                allLines = parseLines(data.text || '');
                updateSongInfo(data.songTitle, data.songKey);
                updateNextSong(data.nextSong, data.nextKey);
                paginate();
                if (totalPages > 0) renderPage(0, false);
                break;

            // Navigate to specific page (1-based)
            case 'goPage':
                renderPage((data.page || 1) - 1, true);
                break;

            case 'nextPage':
                if (currentPage < totalPages - 1) renderPage(currentPage + 1, true);
                break;

            case 'prevPage':
                if (currentPage > 0) renderPage(currentPage - 1, true);
                break;

            case 'firstPage':
                renderPage(0, true);
                break;

            case 'lastPage':
                renderPage(totalPages - 1, true);
                break;

            // Partial settings update
            case 'updateSettings':
                applySettings(data);
                // Re-paginate if font size bounds changed
                if (data.fontMin !== undefined || data.fontMax !== undefined) {
                    paginate();
                    if (totalPages > 0) renderPage(currentPage, false);
                }
                break;

            // Countdown overlay
            case 'countdown':
                countdown(data.seconds || 5);
                break;

            // Fullscreen toggle
            case 'toggleFullscreen':
                toggleFS();
                break;

            // Auto-enter fullscreen (on window open)
            case 'autoFullscreen':
                document.documentElement.requestFullscreen().catch(function () {});
                // Re-paginate after fullscreen transition settles
                setTimeout(function () {
                    paginate();
                    if (totalPages > 0) renderPage(currentPage, false);
                }, 500);
                break;

            // Show message overlay
            case 'showMessage':
                showMessage(data.text, data.duration);
                break;

            // Chronometer sync from control panel
            case 'chronoSync':
                syncChrono(data.elapsed || 0, !!data.running);
                break;
        }
    };

    // ============================================================
    //  RESIZE & FULLSCREEN CHANGE — re-paginate
    // ============================================================
    var resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if (allLines.length) {
                paginate();
                if (totalPages > 0) renderPage(currentPage, false);
            }
        }, 300);
    });

    document.addEventListener('fullscreenchange', function () {
        setTimeout(function () {
            if (allLines.length) {
                paginate();
                if (totalPages > 0) renderPage(currentPage, false);
            }
        }, 400);
    });

    // ============================================================
    //  KEYBOARD NAVIGATION
    // ============================================================
    document.addEventListener('keydown', function (e) {
        switch (e.key) {
            case 'Escape':
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                } else {
                    ch.postMessage({ type: 'closed' });
                    window.close();
                }
                break;

            case 'f':
            case 'F':
                toggleFS();
                break;

            case 'ArrowRight':
            case ' ':
                e.preventDefault();
                if (currentPage < totalPages - 1) renderPage(currentPage + 1, true);
                break;

            case 'ArrowLeft':
                e.preventDefault();
                if (currentPage > 0) renderPage(currentPage - 1, true);
                break;

            case 'Home':
                renderPage(0, true);
                break;

            case 'End':
                renderPage(totalPages - 1, true);
                break;
        }
    });

    // ============================================================
    //  CLICK NAVIGATION — left half prev, right half next
    // ============================================================
    dom.pageArea.addEventListener('click', function (e) {
        var rect = dom.pageArea.getBoundingClientRect();
        if (e.clientX < rect.left + rect.width / 2) {
            if (currentPage > 0) renderPage(currentPage - 1, true);
        } else {
            if (currentPage < totalPages - 1) renderPage(currentPage + 1, true);
        }
    });

    // ============================================================
    //  MOUSE WHEEL NAVIGATION
    // ============================================================
    var wheelCooldown = false;
    document.addEventListener('wheel', function (e) {
        if (wheelCooldown) return;
        wheelCooldown = true;
        setTimeout(function () { wheelCooldown = false; }, 250);

        if (e.deltaY > 0) {
            // Scroll down = next page
            if (currentPage < totalPages - 1) renderPage(currentPage + 1, true);
        } else if (e.deltaY < 0) {
            // Scroll up = prev page
            if (currentPage > 0) renderPage(currentPage - 1, true);
        }
    }, { passive: true });

    // ============================================================
    //  NOTIFY CONTROL PANEL: READY
    // ============================================================
    ch.postMessage({ type: 'ready' });

    // ============================================================
    //  CLEANUP ON UNLOAD
    // ============================================================
    window.addEventListener('beforeunload', function () {
        ch.postMessage({ type: 'closed' });
        stopChronoTick();
    });

})();
