const fs = require('fs');
const readline = require('readline');

async function extract() {
  const rl = readline.createInterface({
    input: fs.createReadStream('C:/Users/abhij/.gemini/antigravity-ide/brain/1d0c7355-37fc-430d-894a-5e7454ec34ee/.system_generated/logs/transcript.jsonl')
  });

  let output = '';
  for await (const line of rl) {
    if (line.includes('USER_EXPLICIT')) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.content) {
            output += parsed.content.substring(0, 100).replace(/\n/g, '\\n') + '\n';
        }
      } catch (e) {}
    }
  }
  fs.writeFileSync('E:/My-APp/ExpenseTracker/user_explicit.txt', output);
  console.log('Done');
}

extract();
