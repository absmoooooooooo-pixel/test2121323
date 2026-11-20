/* ==================================================
   MOBILE INPUT VIEWPORT JAVASCRIPT START
   Reports the sticky header's height to CSS so that a field the phone keyboard
   scrolls into view is never hidden underneath the header.

   THIS SCRIPT DOES NOT RESIZE ANYTHING.
   -------------------------------------
   The engineering drawing keeps exactly the same size whether a field is
   focused, being typed in, emptied, or when the keyboard opens and closes.
   Drawings are SVGs with a fixed viewBox, so their size follows the available
   screen width only.

   There are deliberately no focus, blur or visual-viewport listeners here,
   because reacting to those is what used to shrink the drawing on a phone.
   On the home screen the height of the header is measured and given to CSS, and the size of a drawing
   never changes.
================================================== */
"use strict";

(function () {
    const root = document.documentElement;
    const header = document.querySelector(".header");

    let frame = 0;

    /* Writes the header height into the CSS variable used for scroll padding.
       If the header is not on the page, the CSS fallback value is kept. */
    function measureHeader() {
        if (!header) {
            return;
        }

        const height = Math.round(header.getBoundingClientRect().height);

        if (height > 0) {
            root.style.setProperty("--miv-header-h", height + "px");
        }
    }

    function scheduleMeasure() {
        if (frame) {
            cancelAnimationFrame(frame);
        }

        frame = requestAnimationFrame(function () {
            frame = 0;
            measureHeader();
        });
    }

    scheduleMeasure();

    window.addEventListener("resize", scheduleMeasure, { passive: true });

    window.addEventListener("orientationchange", function () {
        setTimeout(measureHeader, 260);
    }, { passive: true });

    /* Web fonts can change the header's height after it first renders. */
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(scheduleMeasure).catch(function () {});
    }
})();

/* ==================================================
   MOBILE INPUT VIEWPORT JAVASCRIPT END
   This JavaScript file ends here.
================================================== */
