describe('Options page', function() {
  it('should be loadable', async function() {
    await loadPage({
      url: '/addon/content/options/options.html',
      setup: async(browser) => {
        should.exist(browser);
      },
      test: async(content) => {
        should.exist(content.browser);
      },
    });
  })
});
