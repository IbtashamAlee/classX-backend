module.exports = async function (promise) {
  try {
    return [await promise, undefined];
  } catch (e) {
    return [undefined, e];
  }
}


