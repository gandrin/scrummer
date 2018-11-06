const findOrInsertSpan = (parent, className, insertBeforeElement) => {
  let span = parent.querySelector('.' + className)
  if (!span) {
    span = document.createElement('span')
    span.className = className
    parent.insertBefore(span, insertBeforeElement)
  }
  return span
}

const removeIfExists = (parent, className) => {
  let element = parent.querySelector('.' + className)
  if (element) {
    element.parentNode.removeChild(element)
  }
}
