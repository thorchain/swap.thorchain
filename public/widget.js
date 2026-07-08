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
 *     previewText: "Swap crypto"    // floating only: button label
 *   });
 * </script>
 */
(function () {
  var origin = new URL(document.currentScript.src).origin

  function widgetUrl(options) {
    var params = new URLSearchParams()
    if (options.apiKey) params.set('apiKey', options.apiKey)
    if (options.sellAsset) params.set('from', options.sellAsset)
    if (options.buyAsset) params.set('to', options.buyAsset)
    return origin + '/widget?' + params.toString()
  }

  function createIframe(options) {
    var iframe = document.createElement('iframe')
    iframe.src = widgetUrl(options)
    iframe.title = 'THORChain Swap'
    iframe.allow = 'clipboard-write'
    iframe.style.cssText = 'border:0;width:100%;height:100%;'
    return iframe
  }

  function initStatic(options) {
    var container = typeof options.container === 'string' ? document.querySelector(options.container) : options.container
    if (!container) {
      console.error('[ThorchainWidget] container not found:', options.container)
      return
    }

    var iframe = createIframe(options)
    iframe.style.minHeight = '640px'
    container.appendChild(iframe)
  }

  function initFloating(options) {
    var horizontal = options.horizontalPosition === 'left' ? 'left' : 'right'
    var vertical = options.verticalPosition === 'top' ? 'top' : 'bottom'
    var previewText = options.previewText || 'Swap crypto'

    var panel = document.createElement('div')
    panel.style.cssText =
      'position:fixed;' + horizontal + ':24px;' + vertical + ':88px;z-index:2147483646;' +
      'width:440px;max-width:calc(100vw - 48px);height:680px;max-height:calc(100vh - 136px);' +
      'display:none;border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.25);'

    var button = document.createElement('button')
    button.textContent = previewText
    button.style.cssText =
      'position:fixed;' + horizontal + ':24px;' + vertical + ':24px;z-index:2147483647;' +
      'padding:14px 24px;border:0;border-radius:9999px;cursor:pointer;' +
      'background:#33ff99;color:#0b0f0e;font:600 16px/1 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.2);'

    var iframe
    button.addEventListener('click', function () {
      var isOpen = panel.style.display !== 'none'
      if (!isOpen && !iframe) {
        iframe = createIframe(options)
        panel.appendChild(iframe)
      }
      panel.style.display = isOpen ? 'none' : 'block'
      button.textContent = isOpen ? previewText : '✕'
    })

    document.body.appendChild(panel)
    document.body.appendChild(button)
  }

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
    }
  }
})()
