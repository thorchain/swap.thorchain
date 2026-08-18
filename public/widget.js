/**
 * THORChain Swap Widget loader.
 *
 * <script src="https://swap.thorchain.org/widget.js"></script>
 * <script>
 *   ThorchainWidget.init({
 *     apiKey: "YOUR_API_KEY",       // required, issued on swap.thorchain.org/affiliate
 *     type: "floating",             // floating | static (default: static)
 *     container: "#swap",           // static only: selector or element to render into
 *     horizontalPosition: "right",  // floating only: left | right
 *     verticalPosition: "bottom",   // floating only: top | bottom
 *     sellAsset: "BTC.BTC",
 *     buyAsset: "ETH.ETH",
 *     previewText: "Swap crypto",   // floating only: button label
 *     theme: "auto"                 // auto | light | dark | system (default: auto)
 *   });
 * </script>
 *
 * Theming: "auto" matches the host page — the widget reads the effective background
 * behind itself and follows it, live, whenever the page switches its own dark/light
 * mode (no reload, no configuration). "system" follows the visitor's OS preference,
 * "light"/"dark" pin it. Sites that own the toggle themselves can drive it directly:
 *
 *   ThorchainWidget.setTheme("dark")   // or "light" | "system" | "auto"
 */
(function () {
  var origin = new URL(document.currentScript.src).origin
  var MESSAGE_SOURCE = 'thorchain-widget'

  // Chrome the loader draws itself (floating panel + button); the iframe themes its own content.
  var CHROME = {
    light: { panel: '#fafafa', shadow: '0 12px 40px rgba(0,0,0,.25)' },
    dark: { panel: '#0d0d0d', shadow: '0 12px 40px rgba(0,0,0,.55)' }
  }

  var instances = []

  function prefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  // getComputedStyle returns colors in the legacy rgb()/rgba() form.
  function parseColor(value) {
    var open = value.indexOf('(')
    if (open === -1) return null
    var parts = value.slice(open + 1, value.lastIndexOf(')')).split(',')
    if (parts.length < 3) return null
    var rgba = [parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]), parts.length > 3 ? parseFloat(parts[3]) : 1]
    for (var i = 0; i < rgba.length; i++) if (isNaN(rgba[i])) return null
    return rgba
  }

  // First ancestor that actually paints something behind the widget.
  function backdropColor(element) {
    for (var node = element; node; node = node.parentElement) {
      var color = parseColor(window.getComputedStyle(node).backgroundColor)
      if (color && color[3] > 0.1) return color
    }
    return null
  }

  function isDarkColor(rgba) {
    return (0.299 * rgba[0] + 0.587 * rgba[1] + 0.114 * rgba[2]) / 255 < 0.5
  }

  // Host pages signal their mode in many ways (a .dark class, data-theme, a CSS variable
  // swap). They all end up painting a background, so read that instead of guessing at
  // attribute conventions; fall back to color-scheme and then to the OS preference.
  function detectHostTheme(anchor) {
    var backdrop = backdropColor(anchor || document.body)
    if (backdrop) return isDarkColor(backdrop) ? 'dark' : 'light'

    var scheme = String(window.getComputedStyle(document.documentElement).colorScheme || '')
    var dark = scheme.indexOf('dark') !== -1
    var light = scheme.indexOf('light') !== -1
    if (dark !== light) return dark ? 'dark' : 'light'

    return prefersDark() ? 'dark' : 'light'
  }

  function resolveTheme(mode, anchor) {
    if (mode === 'light' || mode === 'dark') return mode
    if (mode === 'system') return prefersDark() ? 'dark' : 'light'
    return detectHostTheme(anchor)
  }

  function widgetUrl(options, theme) {
    var params = new URLSearchParams()
    if (options.apiKey) params.set('apiKey', options.apiKey)
    if (options.sellAsset) params.set('from', options.sellAsset)
    if (options.buyAsset) params.set('to', options.buyAsset)
    params.set('theme', theme)
    return origin + '/widget?' + params.toString()
  }

  function createIframe(options, theme) {
    var iframe = document.createElement('iframe')
    iframe.src = widgetUrl(options, theme)
    iframe.title = 'THORChain Swap'
    iframe.allow = 'clipboard-write'
    iframe.style.cssText = 'border:0;width:100%;height:100%;color-scheme:' + theme + ';'
    return iframe
  }

  function postTheme(iframe, theme) {
    if (!iframe || !iframe.contentWindow) return
    iframe.style.colorScheme = theme
    iframe.contentWindow.postMessage({ source: MESSAGE_SOURCE, type: 'theme', theme: theme }, origin)
  }

  // One instance per init() call: tracks its own anchor element so a widget dropped into a
  // dark panel on an otherwise light page still reads the panel, not the page.
  function register(options, anchor, onThemeChange) {
    var instance = {
      mode: options.theme === 'light' || options.theme === 'dark' || options.theme === 'system' ? options.theme : 'auto',
      anchor: anchor,
      iframe: null,
      theme: null,
      apply: onThemeChange
    }
    instance.theme = resolveTheme(instance.mode, anchor)

    instance.sync = function () {
      var next = resolveTheme(instance.mode, instance.anchor)
      if (next === instance.theme) return
      instance.theme = next
      instance.apply(next)
      postTheme(instance.iframe, next)
    }

    instances.push(instance)
    return instance
  }

  function watchHost() {
    function syncAll() {
      for (var i = 0; i < instances.length; i++) instances[i].sync()
    }

    var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
    if (media) {
      if (media.addEventListener) media.addEventListener('change', syncAll)
      else if (media.addListener) media.addListener(syncAll)
    }

    if (window.MutationObserver) {
      var observer = new MutationObserver(function () {
        syncAll()
        // Themed sites often cross-fade their background; re-read once the transition settled.
        setTimeout(syncAll, 400)
      })
      var config = { attributes: true }
      observer.observe(document.documentElement, config)
      if (document.body) observer.observe(document.body, config)
    }

    // The page re-announces the current theme whenever an iframe finishes booting, so a
    // theme change that happened while it was loading is never lost.
    window.addEventListener('message', function (event) {
      if (event.origin !== origin) return
      var data = event.data
      if (!data || data.source !== MESSAGE_SOURCE || data.type !== 'ready') return
      for (var i = 0; i < instances.length; i++) {
        if (instances[i].iframe && instances[i].iframe.contentWindow === event.source) postTheme(instances[i].iframe, instances[i].theme)
      }
    })
  }

  function initStatic(options) {
    var container = typeof options.container === 'string' ? document.querySelector(options.container) : options.container
    if (!container) {
      console.error('[ThorchainWidget] container not found:', options.container)
      return
    }

    var instance = register(options, container, function () {})
    instance.iframe = createIframe(options, instance.theme)
    instance.iframe.style.minHeight = '640px'
    container.appendChild(instance.iframe)
  }

  function initFloating(options) {
    var horizontal = options.horizontalPosition === 'left' ? 'left' : 'right'
    var vertical = options.verticalPosition === 'top' ? 'top' : 'bottom'
    var previewText = options.previewText || 'Swap crypto'

    var panel = document.createElement('div')
    panel.style.cssText =
      'position:fixed;' + horizontal + ':24px;' + vertical + ':88px;z-index:2147483646;' +
      'width:440px;max-width:calc(100vw - 48px);height:680px;max-height:calc(100vh - 136px);' +
      'display:none;border-radius:20px;overflow:hidden;'

    var button = document.createElement('button')
    button.textContent = previewText
    button.style.cssText =
      'position:fixed;' + horizontal + ':24px;' + vertical + ':24px;z-index:2147483647;' +
      'padding:14px 24px;border:0;border-radius:9999px;cursor:pointer;' +
      'background:#33ff99;color:#0b0f0e;font:600 16px/1 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.2);'

    var instance = register(options, document.body, function (theme) {
      panel.style.background = CHROME[theme].panel
      panel.style.boxShadow = CHROME[theme].shadow
    })
    instance.apply(instance.theme)

    button.addEventListener('click', function () {
      var isOpen = panel.style.display !== 'none'
      if (!isOpen && !instance.iframe) {
        instance.iframe = createIframe(options, instance.theme)
        panel.appendChild(instance.iframe)
      }
      panel.style.display = isOpen ? 'none' : 'block'
      button.textContent = isOpen ? previewText : '✕'
    })

    document.body.appendChild(panel)
    document.body.appendChild(button)
  }

  watchHost()

  window.ThorchainWidget = {
    init: function (options) {
      options = options || {}
      if (!options.apiKey) {
        console.error('[ThorchainWidget] apiKey is required')
        return
      }

      if (options.type === 'floating') {
        initFloating(options)
      } else {
        initStatic(options)
      }
    },

    // Escape hatch for sites that own the toggle: "light" | "dark" | "system" | "auto".
    setTheme: function (theme) {
      var mode = theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'auto'
      for (var i = 0; i < instances.length; i++) {
        instances[i].mode = mode
        instances[i].sync()
      }
    }
  }
})()
