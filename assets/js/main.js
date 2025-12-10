(() => {
    const grid = document.getElementById('eyes');
    const TOTAL_EYES = 20;
    const GRID_LIMITS = { minCols: 2, maxCols: 8, minRows: 2, maxRows: 8 };
    const gridShape = { rows: 0, cols: 0 };
    const specialLinks = [
        { type: 'discord', url: 'https://discord.gg/sak9PMyA42', aria: "Opent de Discord-community van DON'T BLINK." },
        { type: 'youtube', url: 'https://youtu.be/dontblinktrailer', aria: "Bekijk de YouTube-trailer van DON'T BLINK." }
    ];
    const BLINK_SETTINGS = { minDelay: 3500, maxDelay: 9500, duration: 160 };
    const IDLE_BEHAVIOR = {
        initialDelayMin: 4500,
        initialDelayMax: 10500,
        escalateDelayMin: 3800,
        escalateDelayMax: 7600,
        wanderDelayMin: 500,
        wanderDelayMax: 1000,
        travelMultiplier: .5
    };

    let uid = 0;
    function makeEye() {
        const boxW = 140;
        const boxH = 90;
        const cx = boxW / 2;
        const cy = boxH / 2;

        // Per-eye tuning for pupil travel and smoothing
        const baseTravelMin = 6;
        const baseTravelMax = 26;
        const pupilR = 18;
        const lerpAlpha = 0.18;

        const id = `clip-${uid++}`;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${boxW} ${boxH}`);

        const almond = `M 8 ${cy} Q ${cx} ${-2} ${boxW - 8} ${cy} Q ${cx} ${boxH + 2} 8 ${cy} Z`;

        const defs = document.createElementNS(svg.namespaceURI, 'defs');
        const clip = document.createElementNS(svg.namespaceURI, 'clipPath');
        clip.setAttribute('id', id);
        const clipPathShape = document.createElementNS(svg.namespaceURI, 'path');
        clipPathShape.setAttribute('d', almond);
        clip.appendChild(clipPathShape);
        defs.appendChild(clip);
        svg.appendChild(defs);

        const sclera = document.createElementNS(svg.namespaceURI, 'path');
        sclera.setAttribute('d', almond);
        sclera.setAttribute('fill', 'var(--white)');
        sclera.setAttribute('stroke', 'var(--line)');
        sclera.setAttribute('stroke-width', '1');
        svg.appendChild(sclera);

        const g = document.createElementNS(svg.namespaceURI, 'g');
        g.setAttribute('clip-path', `url(#${id})`);

        const pupil = document.createElementNS(svg.namespaceURI, 'circle');
        pupil.setAttribute('cx', cx);
        pupil.setAttribute('cy', cy);
        pupil.setAttribute('r', pupilR);
        pupil.setAttribute('fill', '#15171b');
        pupil.classList.add('pupil');
        g.appendChild(pupil);

        const lidTop = document.createElementNS(svg.namespaceURI, 'rect');
        lidTop.setAttribute('x', '0');
        lidTop.setAttribute('y', '0');
        lidTop.setAttribute('width', boxW);
        lidTop.setAttribute('height', (boxH / 2 + 6).toFixed(2));
        lidTop.setAttribute('style', 'fill: var(--bg);');
        lidTop.classList.add('lid-top');
        g.appendChild(lidTop);

        const lidBottom = document.createElementNS(svg.namespaceURI, 'rect');
        lidBottom.setAttribute('x', '0');
        lidBottom.setAttribute('y', (boxH / 2 - 6).toFixed(2));
        lidBottom.setAttribute('width', boxW);
        lidBottom.setAttribute('height', (boxH / 2 + 6).toFixed(2));
        lidBottom.setAttribute('style', 'fill: var(--bg);');
        lidBottom.classList.add('lid-bottom');
        g.appendChild(lidBottom);

        svg.appendChild(g);

        svg._state = {
            cx,
            cy,
            baseTravelMin,
            baseTravelMax,
            lerpAlpha,
            targetX: cx,
            targetY: cy,
            curX: cx,
            curY: cy,
            pupil,
            isRogue: false,
            wanderNext: 0
        };

        const cell = document.createElement('div');
        cell.className = 'eye';
        cell.appendChild(svg);
        return cell;
    }

    function convertEyeToTitle(cell, word, modifier) {
        if (!cell || cell.classList.contains('title-cell')) return;
        clearSpecial(cell);
        stopBlink(cell);
        const svg = cell.querySelector('svg');
        if (svg) svg.remove();
        cell.classList.remove('eye', 'blinking', 'linked', 'linked-discord', 'linked-youtube', 'armed');
        cell.classList.remove('title-cell-dont', 'title-cell-blink');
        cell.removeAttribute('role');
        cell.removeAttribute('tabindex');
        cell.removeAttribute('aria-label');
        delete cell.dataset.linkType;
        delete cell._linkHandler;
        delete cell._linkEventType;
        delete cell._keyHandler;
        delete cell._blurHandler;
        if (cell._armTimeout) {
            clearTimeout(cell._armTimeout);
            delete cell._armTimeout;
        }
        cell.textContent = '';

        const wordEl = document.createElement('span');
        wordEl.className = `title-word title-word-${modifier}`;
        wordEl.textContent = word;

        cell.classList.add('title-cell', `title-cell-${modifier}`);
        cell.appendChild(wordEl);
    }

    function chooseTitleIndices(rows, cols, count) {
        if (count < 2) return null;

        // Helper: ensure titles are never adjacent (including diagonals).
        // Enforce Chebyshev distance >= 2 between positions.
        const isSeparated = (a, b) => {
            const ar = Math.floor(a / cols);
            const ac = a % cols;
            const br = Math.floor(b / cols);
            const bc = b % cols;
            const dr = Math.abs(ar - br);
            const dc = Math.abs(ac - bc);
            return Math.max(dr, dc) >= 2;
        };

        const attempts = Math.min(count * 3, 18);
        for (let attempt = 0; attempt < attempts; attempt++) {
            const dontIndex = Math.floor(Math.random() * count);
            const dontRow = Math.floor(dontIndex / cols);
            const dontCol = dontIndex % cols;

            // Prefer any cell on lower rows; otherwise, same row to the right
            const lowerRows = [];
            const sameRow = [];
            for (let i = 0; i < count; i++) {
                if (i === dontIndex) continue;
                const row = Math.floor(i / cols);
                const col = i % cols;
                if (row > dontRow) lowerRows.push(i);
                else if (row === dontRow && col >= dontCol + 2) sameRow.push(i); // at least one eye between in same row
            }

            // Filter with separation rule (avoid adjacency including diagonal)
            const lowerValid = lowerRows.filter(i => isSeparated(dontIndex, i));
            const sameRowValid = sameRow.filter(i => isSeparated(dontIndex, i));
            const blinkPool = lowerValid.length ? lowerValid : sameRowValid;
            if (!blinkPool.length) continue;
            const blinkIndex = blinkPool[Math.floor(Math.random() * blinkPool.length)];
            return { dontIndex, blinkIndex };
        }

        // Fallback: deterministic scan honoring constraints
        for (let dontIndex = 0; dontIndex < count; dontIndex++) {
            const dontRow = Math.floor(dontIndex / cols);
            const dontCol = dontIndex % cols;
            // First, scan lower rows
            for (let blinkIndex = 0; blinkIndex < count; blinkIndex++) {
                if (blinkIndex === dontIndex) continue;
                const row = Math.floor(blinkIndex / cols);
                if (row > dontRow && isSeparated(dontIndex, blinkIndex)) {
                    return { dontIndex, blinkIndex };
                }
            }
            // Then, scan same row to the right with at least 1 gap
            for (let blinkIndex = 0; blinkIndex < count; blinkIndex++) {
                if (blinkIndex === dontIndex) continue;
                const row = Math.floor(blinkIndex / cols);
                const col = blinkIndex % cols;
                if (row === dontRow && col >= dontCol + 2 && isSeparated(dontIndex, blinkIndex)) {
                    return { dontIndex, blinkIndex };
                }
            }
        }
        return null;
    }

    function computeGridShape() {
        const ratio = window.innerWidth && window.innerHeight ? window.innerWidth / window.innerHeight : 1;
        const idealCols = Math.round(Math.sqrt(TOTAL_EYES * ratio));
        const cols = Math.max(GRID_LIMITS.minCols, Math.min(GRID_LIMITS.maxCols, idealCols));
        const neededRows = Math.ceil(TOTAL_EYES / cols);
        const rows = Math.max(GRID_LIMITS.minRows, Math.min(GRID_LIMITS.maxRows, neededRows));
        return { rows, cols };
    }

    const rogueEyes = new Set();
    let idleTimeoutId = null;
    let escalationTimeoutId = null;

    function randomRange(min, max) {
        return min + Math.random() * (max - min);
    }

    function chooseRandomIndices(count, max) {
        const pool = Array.from({ length: max }, (_, i) => i);
        const picks = [];
        for (let i = 0; i < count && pool.length; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            picks.push(pool.splice(idx, 1)[0]);
        }
        return picks;
    }

    function clearEyeRogue(svg) {
        if (!svg || !svg._state || !svg._state.isRogue) return;
        svg._state.isRogue = false;
        svg._state.wanderNext = 0;
        const cell = svg.closest('.eye');
        if (cell) cell.classList.remove('eye-rogue');
        rogueEyes.delete(svg);
    }

    function resetAllRogueEyes() {
        const current = Array.from(rogueEyes);
        current.forEach(svg => clearEyeRogue(svg));
        rogueEyes.clear();
    }

    function setEyeRogue(svg) {
        if (!svg || !svg._state || svg._state.isRogue) return false;
        svg._state.isRogue = true;
        svg._state.wanderNext = 0;
        const cell = svg.closest('.eye');
        if (cell) cell.classList.add('eye-rogue');
        rogueEyes.add(svg);
        return true;
    }

    function addRandomRogueEye() {
        const candidates = Array.from(grid.querySelectorAll('.eye svg')).filter(svg => svg._state && !svg._state.isRogue);
        if (!candidates.length) return false;
        const choice = candidates[Math.floor(Math.random() * candidates.length)];
        return setEyeRogue(choice);
    }

    function clearIdleTimers() {
        if (idleTimeoutId) {
            clearTimeout(idleTimeoutId);
            idleTimeoutId = null;
        }
        if (escalationTimeoutId) {
            clearTimeout(escalationTimeoutId);
            escalationTimeoutId = null;
        }
    }

    function scheduleNextEscalation() {
        clearTimeout(escalationTimeoutId);
        const totalEyes = grid.querySelectorAll('.eye svg').length;
        if (!totalEyes || rogueEyes.size >= totalEyes) return;
        const delay = randomRange(IDLE_BEHAVIOR.escalateDelayMin, IDLE_BEHAVIOR.escalateDelayMax);
        escalationTimeoutId = setTimeout(() => {
            if (addRandomRogueEye()) scheduleNextEscalation();
        }, delay);
    }

    function startIdleSequence() {
        if (!addRandomRogueEye()) return;
        scheduleNextEscalation();
    }

    function scheduleIdleTimer() {
        clearTimeout(idleTimeoutId);
        const delay = randomRange(IDLE_BEHAVIOR.initialDelayMin, IDLE_BEHAVIOR.initialDelayMax);
        idleTimeoutId = setTimeout(() => {
            idleTimeoutId = null;
            startIdleSequence();
        }, delay);
    }

    function handleUserActivity() {
        clearIdleTimers();
        if (rogueEyes.size) resetAllRogueEyes();
        scheduleIdleTimer();
    }

    function stopBlink(cell) {
        if (cell._blinkStart) {
            clearTimeout(cell._blinkStart);
            delete cell._blinkStart;
        }
        if (cell._blinkEnd) {
            clearTimeout(cell._blinkEnd);
            delete cell._blinkEnd;
        }
        cell.classList.remove('blinking');
    }

    function scheduleBlink(cell) {
        stopBlink(cell);
        const delayRange = BLINK_SETTINGS.maxDelay - BLINK_SETTINGS.minDelay;
        const delay = BLINK_SETTINGS.minDelay + Math.random() * delayRange;
        cell._blinkStart = setTimeout(() => {
            cell.classList.add('blinking');
            cell._blinkEnd = setTimeout(() => {
                cell.classList.remove('blinking');
                scheduleBlink(cell);
            }, BLINK_SETTINGS.duration);
        }, delay);
    }

    function createLogoGroup(svg, type) {
        const st = svg._state;
        const ns = svg.namespaceURI;
        const group = document.createElementNS(ns, 'g');
        group.classList.add('logo', `logo-${type}`);
        group.setAttribute('pointer-events', 'none');

        const radius = parseFloat(st.pupil.getAttribute('r')) || 18;
        const size = radius * 2.1;
        const cx = st.cx;
        const cy = st.cy;

        const image = document.createElementNS(ns, 'image');
        const href = type === 'discord' ? 'assets/icons/DiscordLogo.png' : 'assets/icons/YoutubeLogo.png';
        image.setAttribute('x', (cx - size / 2).toFixed(2));
        image.setAttribute('y', (cy - size / 2).toFixed(2));
        image.setAttribute('width', size.toFixed(2));
        image.setAttribute('height', size.toFixed(2));
        image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        image.setAttribute('href', href);
        image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href);
        image.setAttribute('style', 'pointer-events:none;');
        group.appendChild(image);

        return group;
    }

    function clearSpecial(cell) {
        stopBlink(cell);
        if (!cell.classList.contains('linked')) return;
        if (cell._linkHandler) {
            if (cell._linkEventType) {
                cell.removeEventListener(cell._linkEventType, cell._linkHandler);
            } else {
                cell.removeEventListener('click', cell._linkHandler);
                cell.removeEventListener('dblclick', cell._linkHandler);
            }
            delete cell._linkHandler;
            delete cell._linkEventType;
        }
        if (cell._keyHandler) {
            cell.removeEventListener('keydown', cell._keyHandler);
            delete cell._keyHandler;
        }
        if (cell._blurHandler) {
            cell.removeEventListener('blur', cell._blurHandler);
            delete cell._blurHandler;
        }
        cell.classList.remove('linked', 'linked-discord', 'linked-youtube');
        cell.classList.remove('armed');
        cell.removeAttribute('role');
        cell.removeAttribute('tabindex');
        cell.removeAttribute('aria-label');
        delete cell.dataset.linkType;

        const svg = cell.querySelector('svg');
        if (svg && svg._state && svg._state.pupil) {
            svg._state.pupil.setAttribute('fill', '#15171b');
        }
        if (svg) {
            const inner = svg.querySelector('g');
            if (inner) {
                inner.querySelectorAll('.logo').forEach(logo => logo.remove());
            }
        }
    }

    function markSpecial(cell, spec) {
        clearSpecial(cell);
        const svg = cell.querySelector('svg');
        if (!svg || !svg._state) return;
        const inner = svg.querySelector('g');
        if (!inner) return;

        svg._state.pupil.setAttribute('fill', '#7a0d0d');
        const logo = createLogoGroup(svg, spec.type);
        inner.appendChild(logo);

        const openLink = () => window.open(spec.url, '_blank', 'noopener');
        const isMobile = typeof window.mobileCheck === 'function' && window.mobileCheck();
        const pointerEvent = 'click';
        const requiresArm = !!isMobile;

        const disarm = () => {
            cell.classList.remove('armed');
        };

        const clickHandler = (event) => {
            if (requiresArm) {
                if (!cell.classList.contains('armed')) {
                    event.preventDefault();
                    cell.classList.add('armed');
                    if (typeof cell.focus === 'function') {
                        cell.focus({ preventScroll: true });
                    }
                    return;
                }
                disarm();
            }
            event.preventDefault();
            openLink();
        };
        const keyHandler = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                disarm();
                openLink();
            }
        };

        cell.classList.add('linked', `linked-${spec.type}`);
        cell.dataset.linkType = spec.type;
        cell.setAttribute('role', 'link');
        cell.setAttribute('tabindex', '0');
        cell.setAttribute('aria-label', spec.aria);
        cell.addEventListener(pointerEvent, clickHandler);
        cell.addEventListener('keydown', keyHandler);
        if (requiresArm) {
            cell.addEventListener('blur', disarm);
            cell._blurHandler = disarm;
        } else if (cell._blurHandler) {
            cell.removeEventListener('blur', cell._blurHandler);
            delete cell._blurHandler;
        }
        cell._linkHandler = clickHandler;
        cell._linkEventType = pointerEvent;
        cell._keyHandler = keyHandler;

        scheduleBlink(cell);
    }

    function assignSpecialEyes() {
        const allEyes = Array.from(grid.querySelectorAll('.eye'));
        allEyes.forEach(clearSpecial);
        if (allEyes.length < specialLinks.length) return;

        // On mobile-like devices, avoid placing specials in the "lower-ish" rows.
        const mediaCoarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
        const narrowScreen = Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 820;
        const isMobileLike = (typeof window.mobileCheck === 'function' && window.mobileCheck()) || mediaCoarse || narrowScreen;
        let candidates = allEyes;
        if (isMobileLike && gridShape && gridShape.rows && gridShape.cols) {
            const rows = gridShape.rows;
            const cols = gridShape.cols;

            // Start by avoiding roughly the bottom 35% of rows, but at least 1 row; never exclude all rows.
            let rowsToAvoid = Math.max(1, Math.min(rows - 1, Math.round(rows * 0.35)));

            const buildCandidates = (avoid) => allEyes.filter(cell => {
                const idx = Array.prototype.indexOf.call(grid.children, cell);
                if (idx < 0) return false;
                const row = Math.floor(idx / cols);
                return row < rows - avoid;
            });

            candidates = buildCandidates(rowsToAvoid);

            // If not enough candidates, relax the constraint until we have enough or none left to relax
            while (candidates.length < specialLinks.length && rowsToAvoid > 0) {
                rowsToAvoid -= 1;
                candidates = buildCandidates(rowsToAvoid);
            }

            // Final fallback to all eyes if still not enough
            if (candidates.length < specialLinks.length) {
                candidates = allEyes;
            }
        }

        const indices = chooseRandomIndices(specialLinks.length, candidates.length);
        if (indices.length < specialLinks.length) return;
        const specs = specialLinks.slice().sort(() => Math.random() - 0.5);
        specs.forEach((spec, i) => {
            const cell = candidates[indices[i]];
            if (cell) markSpecial(cell, spec);
        });
    }

    function rebuildEyes(force = false) {
        const { rows, cols } = computeGridShape();
        if (!force && rows === gridShape.rows && cols === gridShape.cols) return;
        gridShape.rows = rows;
        gridShape.cols = cols;
        grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

        const existingTitles = Array.from(grid.querySelectorAll('.title-cell'));
        existingTitles.forEach(titleCell => {
            const replacement = makeEye();
            grid.replaceChild(replacement, titleCell);
        });

        resetAllRogueEyes();

        const totalSlots = rows * cols;
        let eyes = Array.from(grid.querySelectorAll('.eye'));
        const current = eyes.length;
        if (current < totalSlots) {
            for (let i = current; i < totalSlots; i++) grid.appendChild(makeEye());
        } else if (current > totalSlots) {
            for (let i = current - 1; i >= totalSlots; i--) {
                const cell = eyes[i];
                if (!cell) continue;
                clearSpecial(cell);
                grid.removeChild(cell);
            }
        }

        eyes = Array.from(grid.querySelectorAll('.eye'));
        const titleSelection = chooseTitleIndices(rows, cols, eyes.length);
        if (titleSelection) {
            const { dontIndex, blinkIndex } = titleSelection;
            if (eyes[dontIndex]) convertEyeToTitle(eyes[dontIndex], "DON'T", 'dont');
            if (eyes[blinkIndex]) convertEyeToTitle(eyes[blinkIndex], 'BLINK', 'blink');
        }

        assignSpecialEyes();
    }

    let mouseX = innerWidth / 2;
    let mouseY = innerHeight / 2;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;

    function computeTargets(svg) {
        const st = svg._state;
        const rect = svg.getBoundingClientRect();
        const cxScreen = rect.left + rect.width * (st.cx / svg.viewBox.baseVal.width);
        const cyScreen = rect.top + rect.height * (st.cy / svg.viewBox.baseVal.height);

        const dx = mouseX - cxScreen;
        const dy = mouseY - cyScreen;
        const pointerInside = mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom;

        if (pointerInside) {
            const nx = (mouseX - rect.left) / rect.width - 0.5;
            const ny = (mouseY - rect.top) / rect.height - 0.5;
            const maxX = st.baseTravelMax * 1.15;
            const maxY = st.baseTravelMax * (rect.height / rect.width) * 1.1;
            const offsetX = clamp(nx * 2 * maxX, -maxX, maxX);
            const offsetY = clamp(ny * 2 * maxY, -maxY, maxY);
            st.targetX = st.cx + offsetX;
            st.targetY = st.cy + offsetY;
        } else {
            const angle = Math.atan2(dy, dx);
            const dist = Math.hypot(dx, dy);
            const eyeRadiusScreen = Math.max(rect.width, rect.height) * 0.8;
            const proximity = clamp(1 - dist / (eyeRadiusScreen * 6), 0, 1);
            const travel = st.baseTravelMin + proximity * (st.baseTravelMax - st.baseTravelMin);
            st.targetX = st.cx + Math.cos(angle) * travel;
            st.targetY = st.cy + Math.sin(angle) * travel;
        }
    }

    function updateRogueTargets(svg, now) {
        const st = svg._state;
        if (!st.isRogue) return;
        if (!st.wanderNext || now >= st.wanderNext) {
            const maxTravel = st.baseTravelMax * IDLE_BEHAVIOR.travelMultiplier;
            const travel = randomRange(st.baseTravelMin * 0.6, maxTravel);
            const angle = Math.random() * Math.PI * 2;
            const targetX = st.cx + Math.cos(angle) * travel;
            const targetY = st.cy + Math.sin(angle) * travel;
            st.targetX = clamp(targetX, st.cx - maxTravel, st.cx + maxTravel);
            st.targetY = clamp(targetY, st.cy - maxTravel, st.cy + maxTravel);
            st.wanderNext = now + randomRange(IDLE_BEHAVIOR.wanderDelayMin, IDLE_BEHAVIOR.wanderDelayMax);
        }
    }

    function tick(now) {
        const svgs = grid.querySelectorAll('svg');
        const timestamp = typeof now === 'number' ? now : performance.now();
        svgs.forEach(svg => {
            const st = svg._state;
            if (!st) return;
            if (st.isRogue) updateRogueTargets(svg, timestamp);
            else computeTargets(svg);
            st.curX = lerp(st.curX, st.targetX, st.lerpAlpha);
            st.curY = lerp(st.curY, st.targetY, st.lerpAlpha);
            st.pupil.setAttribute('cx', st.curX.toFixed(2));
            st.pupil.setAttribute('cy', st.curY.toFixed(2));
        });
        requestAnimationFrame(tick);
    }

    window.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        handleUserActivity();
    }, { passive: true });

    window.addEventListener('touchmove', e => {
        const t = e.touches[0];
        if (t) {
            mouseX = t.clientX;
            mouseY = t.clientY;
        }
        handleUserActivity();
    }, { passive: true });

    window.addEventListener('resize', () => {
        rebuildEyes();
        handleUserActivity();
    });

    window.addEventListener('mousedown', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);

    window.mobileCheck = function() {
    let check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
    return check;
    };

    rebuildEyes(true);
    requestAnimationFrame(tick);
    scheduleIdleTimer();
})();
