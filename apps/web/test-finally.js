async function delay() { return new Promise(r => setTimeout(r, 100)); }
async function test(depth) {
  try {
    console.log('try', depth);
    if (depth < 1) {
      return test(depth + 1);
    }
    await delay();
    console.log('done', depth);
  } finally {
    console.log('finally', depth);
  }
}
test(0);
