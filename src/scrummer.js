const POINTS_SCALE = [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100];
const STORY_POINTS_REGEXP = /\((\?|\d+\.?,?\d*)\)/m;
const POST_POINTS_REGEXP = /\[(\?|\d+\.?,?\d*)\]/m;

let debounceTimeout

const debounce = (func, wait, immediate) => {
  return function () {
    let context = this,
      args = arguments
    const later = () => {
      debounceTimeout = null
      if (!immediate) func.apply(context, args)
    }
    let callNow = immediate && !debounceTimeout
    clearTimeout(debounceTimeout)
    debounceTimeout = setTimeout(later, wait)
    if (callNow) func.apply(context, args)
  }
}

const containsNodeWithClass = (nodeList, className) => {
  for (let i = 0; i < nodeList.length; i++) {
    if (nodeList[i].classList && nodeList[i].classList.contains(className)) {
      return true
    }
  }
}

let listChangeObserver = new MutationObserver(function (mutations) {
  mutations.forEach(function (mutation) {
    // if the mutation was triggered by us adding or removing badges, do not recalculate
    if (
      (mutation.addedNodes.length === 1 &&
        containsNodeWithClass(mutation.addedNodes, 'scrummer-points')) ||
      (mutation.addedNodes.length === 1 &&
        containsNodeWithClass(mutation.addedNodes, 'scrummer-post-points')) ||
      (mutation.addedNodes.length === 1 &&
        containsNodeWithClass(mutation.addedNodes, 'scrummer-hours')) ||
      (mutation.addedNodes.length === 1 &&
        containsNodeWithClass(mutation.addedNodes, 'scrummer-card-id')) ||
      (mutation.removedNodes.length === 1 &&
        containsNodeWithClass(mutation.removedNodes, 'scrummer-points')) ||
      (mutation.removedNodes.length === 1 &&
        containsNodeWithClass(mutation.removedNodes, 'scrummer-hours')) ||
      (mutation.removedNodes.length === 1 &&
        containsNodeWithClass(mutation.removedNodes, 'scrummer-post-points'))
    )
      return

    // If the list was modified, recalculate
    if (
      mutation.target.classList.contains('list-cards') ||
      mutation.target.classList.contains('list-header-num-cards') ||
      mutation.target.classList.contains('js-list-sortable')
    ) {
      setTimeout(calculatePointsForBoardDebounced)
      return
    }

    // If a single card's content is mutated
    if (mutation.target.classList.contains('js-card-name')) {
      mutation.target.setAttribute('data-mutated', 1)

      setTimeout(calculatePointsForBoardDebounced)
    }
  })
})

const calculatePointsForBoardRdyToDebounce = () => {
  calculatePointsForBoard(settings)
}

const calculatePointsForBoardDebounced = () => {
  debounce(calculatePointsForBoardRdyToDebounce, 100)()
}

const buildPickerRow = storyOrPost => {
  let row = document.createElement('div')
  row.className = 'scrummer-picker-row'

  POINTS_SCALE.forEach(function (value) {
    let button = document.createElement('a')
    button.textContent = value
    button.href = 'javascript:;'

    button.addEventListener(
      'click',
      insertPoints.bind(this, value, storyOrPost)
    )
    button.className =
      storyOrPost === 'story'
        ? 'scrummer-picker-button'
        : 'scrummer-picker-post-button'
    row.appendChild(button)
  })

  return row
}

/**
 * The point picker
 */
const buildPicker = () => {
  let itemsContainer = document.createElement('div')
  itemsContainer.className = 'scrummer-picker-container'
  if (settings.showStoryPoints)
    itemsContainer.appendChild(buildPickerRow('story'))
  if (settings.showPostPoints)
    itemsContainer.appendChild(buildPickerRow('post'))

  return itemsContainer
}

/**
 * This sets up a listener to see if a detail window is presented
 */
const setupWindowListener = callback => {
  let windowChangeObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (
        mutation.target.classList.contains('js-card-detail-title-input') &&
        mutation.target.classList.contains('is-editing')
      ) {
        callback()
      }
    })
  })

  windowChangeObserver.observe(document.querySelector('.window-overlay'), {
    childList: false,
    characterData: false,
    attributes: true,
    subtree: true,
    attributeFilter: ['class']
  })
}

Podium = {}
Podium.keydown = function (k) {
  let oEvent = document.createEvent('KeyboardEvent')

  // Chromium Hack
  Object.defineProperty(oEvent, 'keyCode', {
    get: function () {
      return this.keyCodeVal
    }
  })
  Object.defineProperty(oEvent, 'which', {
    get: function () {
      return this.keyCodeVal
    }
  })

  if (oEvent.initKeyboardEvent) {
    oEvent.initKeyboardEvent(
      'keydown',
      true,
      true,
      document.defaultView,
      false,
      false,
      false,
      false,
      k,
      k
    )
  } else {
    oEvent.initKeyEvent(
      'keydown',
      true,
      true,
      document.defaultView,
      false,
      false,
      false,
      false,
      k,
      0
    )
  }

  oEvent.keyCodeVal = k

  if (oEvent.keyCode !== k) {
    alert('keyCode mismatch ' + oEvent.keyCode + '(' + oEvent.which + ')')
  }

  document.dispatchEvent(oEvent)
}

/**
 * Action when a picker button is clicked
 */
const insertPoints = (value, storyOrPost, event) => {
  event.stopPropagation()

  let titleField = document.querySelector('.js-card-detail-title-input')

  titleField.click()
  titleField.focus()

  // Remove old points
  if (storyOrPost === 'story') {
    let cleanedTitle = titleField.value.replace(STORY_POINTS_REGEXP, '').trim()
    titleField.value = '(' + value + ') ' + cleanedTitle
  } else {
    let cleanedTitle = titleField.value.replace(POST_POINTS_REGEXP, '').trim()
    titleField.value = '[' + value + '] ' + cleanedTitle
  }

  Podium.keydown(13)

  // Hide controls
  document
    .querySelector('.scrummer-picker-container')
    .parentNode.removeChild(
      document.querySelector('.scrummer-picker-container')
    )
}

const checkForLists = () => {
  if (document.querySelectorAll('.list').length > 0) {
    calculatePointsForBoardRdyToDebounce()

    if (settings.showPicker) {
      setupWindowListener(function () {
        if (document.querySelector('.scrummer-picker-container')) {
          return
        }

        let editControls = document.querySelector('.js-current-list')
        editControls.insertBefore(buildPicker(), editControls.firstChild)
      })
    }
  } else {
    setTimeout(checkForLists, 300)
  }
}

let settings = {}
chrome.storage.sync.get(null, _settings => {
  ;[
    'showCardNumbers',
    'showStoryPoints',
    'showPostPoints',
    'showColumnTotals',
    'showBoardTotals',
    'showPicker'
  ].forEach(option => {
    if (_settings[option] === undefined) _settings[option] = true
  })
  settings = _settings

  // Launch the plugin by checking at a certain interval if any lists have been loaded.
  // Wait 1 second because some DOM rebuilding may happen late.
  setTimeout(checkForLists, 1000)
})
