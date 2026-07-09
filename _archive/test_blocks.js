const contentBlockQuery = require('./models/contentBlockQuery');

async function run() {
  const userId = 1; // assume user 1 exists

  console.log('--- Testing Content Blocks ---');
  
  // 1. Create a block
  const b1 = await contentBlockQuery.create(userId, 'skill', 'Expert in Node.js and Express.', ['nodejs', 'backend']);
  console.log('Created block 1:', b1.id);
  
  const b2 = await contentBlockQuery.create(userId, 'project', 'Built a scalable microservices architecture using Kubernetes.', ['kubernetes', 'devops']);
  console.log('Created block 2:', b2.id);

  // 2. Fetch all
  const all = await contentBlockQuery.findAll(userId);
  console.log('Total blocks for user:', all.length);

  // 3. Search
  const search = await contentBlockQuery.searchByJobDescription(userId, 'We are looking for someone with Kubernetes experience to handle our devops.');
  console.log('Search matched:', search.length, 'blocks. Top match:', search[0]?.text);

  // 4. Delete
  await contentBlockQuery.delete(b1.id, userId);
  await contentBlockQuery.delete(b2.id, userId);
  console.log('Cleanup done.');

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
