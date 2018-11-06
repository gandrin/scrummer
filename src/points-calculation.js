const getTitleDataConfiguration = settings => {
  return {
    story: {
      attribute: 'data-calculated-points',
      cssClass: 'scrummer-points',
      isActivated: settings.showStoryPoints,
      regex: STORY_POINTS_REGEXP,
      defaultValue: 0
    },
    post: {
      attribute: 'data-calculated-post-points',
      cssClass: 'scrummer-post-points',
      isActivated: settings.showPostPoints,
      regex: POST_POINTS_REGEXP,
      defaultValue: 0
    },
    hours: {
      attribute: 'data-calculated-hours',
      cssClass: 'scrummer-hours',
      isActivated: true,
      regex: /\$(\?|\d+\.?,?\d*)\$/m,
      defaultValue: 0
    }
  }
};

const getDefaultReturnValue = (settings) => {
  const defaultReturnValue = {};
  const titleDataConfiguration = getTitleDataConfiguration(settings);
  for (const dataId in titleDataConfiguration) {
    defaultReturnValue[dataId] = titleDataConfiguration[dataId].defaultValue
  }
  return defaultReturnValue;
}

const extractDataFromCardTitle = (title, regex) => {
  const matches = title.match(regex)
  if (matches) {
    const extraction = matches[1]
    if (extraction === '?') return '?'
    return parseFloat(extraction.replace(',', '.'))
  }
};

const getCardTitleData = (card, title, config) => {
  const { attribute, cssClass, isActivated, regex } = config;
  const extractedData = isActivated
    ? extractDataFromCardTitle(title, regex)
    : null;

  // Trello sometimes drops our badge, so if that happens we need to redraw
  const contentMutated = card.getAttribute(attribute) !== null && !card.querySelector(`.${cssClass}`)
  const dataHasChanged = card.getAttribute(attribute) == extractedData
  return {
    extractedData,
    isMutated: contentMutated || dataHasChanged
  }
};

const updateCard = (card, cardNameElement, extractedData, attribute, cssClass) => {
  if (extractedData === undefined) {
    return removeIfExists(cardNameElement, cssClass)
  }

  const badgeElement = findOrInsertSpan(
    cardNameElement,
    cssClass,
    cardNameElement.lastChild
  )
  badgeElement.textContent = formatPoints(extractedData)
  card.setAttribute(attribute, extractedData)
}

const updateList = (listHeader, extractedData, isActivated, cssClass) => {
  if (isActivated) {
    let badge = findOrInsertSpan(
      listHeader,
      cssClass,
      listHeader.querySelector('.js-list-name-input')
    )
    badge.textContent = formatPoints(extractedData)
  }
}

const updateBoard = (boardHeader, extractedData, isActivated, cssClass) => {
  if (isActivated) {
    let badge = findOrInsertSpan(
      boardHeader,
      cssClass,
      boardHeader.querySelector('.board-header-btn-name')
    )
    badge.textContent = formatPoints(extractedData)
  }
}

const calculatePointsForCard = (card, settings) => {
  const cardNameElement = card.querySelector('.js-card-name')
  if (!cardNameElement) {
    return getDefaultReturnValue(settings)
  }

  let cardShortId = cardNameElement.querySelector('.card-short-id')
  if (
    settings.showCardNumbers &&
    cardShortId &&
    !cardShortId.classList.contains('scrummer-card-id')
  ) {
    cardShortId.classList.add('scrummer-card-id')
  }

  let originalTitle = card.getAttribute('data-original-title')
  if (!originalTitle || cardNameElement.getAttribute('data-mutated') == 1) {
    originalTitle = cardNameElement.lastChild.textContent
    cardNameElement.setAttribute('data-mutated', 0)
    card.setAttribute('data-original-title', originalTitle)
  }
  if (!originalTitle) {
    return getDefaultReturnValue(settings)
  }

  let hasOneDataMutated = false;
  const dataInTile = {};
  const titleDataConfiguration = getTitleDataConfiguration(settings);
  for (const dataId in titleDataConfiguration) {
    const { extractedData, isMutated } = getCardTitleData(card, originalTitle, titleDataConfiguration[dataId]);
    dataInTile[dataId] = sanitizePoints(extractedData);
    hasOneDataMutated = hasOneDataMutated || isMutated;
  }

  if (!hasOneDataMutated) {
    return dataInTile;
  }

  let cleanedTitle = originalTitle
  for (const dataId in titleDataConfiguration) {
    const { attribute, cssClass, isActivated, regex } = titleDataConfiguration[dataId]
    updateCard(card, cardNameElement, dataInTile[dataId], attribute, cssClass)
    if (isActivated) {
      cleanedTitle = cleanedTitle.replace(regex, '')
    }
  }
  cardNameElement.lastChild.textContent = cleanedTitle.trim()

  return dataInTile
}

const calculatePointsForList = (list, settings) => {
  listChangeObserver.observe(list, {
    childList: true,
    characterData: false,
    attributes: false,
    subtree: true
  })
  listChangeObserver.observe(list.querySelector('.list-header-num-cards'), {
    attributes: true
  })

  // Array.slice can convert a NodeList to an array
  let listPoints = Array.prototype.slice
    .call(list.querySelectorAll('.list-card:not(.hide)'))
    .reduce(
      (listPoints, card) => {
        const cardData = calculatePointsForCard(card, settings);
        for (const dataId in cardData) {
          listPoints[dataId] += cardData[dataId]
        }
        return listPoints
      },
      getDefaultReturnValue(settings)
    )

  debugger
  let listHeader;
  if (
    settings.showColumnTotals &&
    (listHeader = list.querySelector('.js-list-header'))
  ) {
    // Add or update points badges
    const titleDataConfiguration = getTitleDataConfiguration(settings);
    for (const dataId in titleDataConfiguration) {
      const { isActivated, cssClass } = titleDataConfiguration[dataId];
      updateList(listHeader, listPoints[dataId], isActivated, cssClass)
    }
  }

  return listPoints
}

const calculatePointsForBoard = (settings) => {
  // Array.slice can convert a NodeList to an array
  let boardPoints = Array.prototype.slice
    .call(document.querySelectorAll('.list'))
    .reduce(
      (boardPoints, list) => {
        const listData = calculatePointsForList(list, settings);
        for (const dataId in listData) {
          boardPoints[dataId] += listData[dataId]
        }
        return boardPoints
      },
      getDefaultReturnValue(settings)
    )

  let boardHeader = null
  if (
    settings.showBoardTotals &&
    (boardHeader = document.querySelector('.js-board-header'))
  ) {
    // Add or update points badges
    const titleDataConfiguration = getTitleDataConfiguration(settings);
    for (const dataId in titleDataConfiguration) {
      const { isActivated, cssClass } = titleDataConfiguration[dataId];
      updateBoard(boardHeader, boardPoints[dataId], isActivated, cssClass)
    }
  }

  listChangeObserver.observe(document.querySelector('.js-list-sortable'), {
    childList: true,
    characterData: false,
    attributes: false
  })
}
