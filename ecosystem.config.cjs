module.exports = {
  apps: [
    {
      name: '01-get-papers',
      script: './src/01_get_papers/cli.ts',
      interpreter: './node_modules/.bin/tsx',
      args: '--wait 900', // 15 minutes
      env: {
        BROWSER_DATA_DIR: './data/.browser_data_scrape_hf',
      },
      watch: false
    },
    {
      name: '02-make-podcast',
      script: './src/02_make_podcast/cli.ts',
      interpreter: './node_modules/.bin/tsx',
      args: '--wait 900', // 15 minutes
      watch: false
    },
    {
      name: '03-publish-podcast',
      script: './src/03_publish_podcast/cli.ts',
      interpreter: './node_modules/.bin/tsx',
      args: '--wait 900', // 15 minutes
      watch: false
    }
  ],
};
