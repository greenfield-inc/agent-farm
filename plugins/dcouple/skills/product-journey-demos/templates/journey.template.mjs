// Journey NN: <title, as in journeys.html section id="jNN">.
// <What the recording shows, and which writes are faked.>
//
// Copy to <project>/journeys/jNN.mjs and replace every <...>. Start on the
// start screen; 4-8 steps (8-14 end to end); one-sentence captions of 95
// characters or fewer with exact UI labels; "it worked" steps target the
// result; the last caption names any gap from the map.

const TEXT = '<what the person types, demo data only>'

export default {
  id: 'jNN', // equals the file name
  slug: '<short-kebab-slug>',
  title: '<Short journey title>',
  // Optional: start: { mode: 'preLogin', route }, ready, world, setup,
  // fakes, rest, failures, camera, popups (see references/harness.md).

  steps: [
    {
      title: '<Go to the feature>',
      caption: '<Click X in the left menu.>',
      target: ({ app }) => app.getByRole('link', { name: '<X>' }),
    },
    {
      title: '<Type>',
      caption: '<Type ... in the ... box.>',
      target: ({ app }) => app.getByRole('textbox', { name: '<Label>' }),
      action: 'type',
      text: TEXT,
    },
    {
      title: '<Save>',
      caption: '<Click Save.>',
      target: ({ app }) => app.getByRole('button', { name: '<Save>' }),
    },
    {
      title: '<It worked>',
      caption: '<The result, plus any gap from the map.>',
      target: ({ app }) => app.getByText(TEXT).last(),
      action: 'none',
      wait: 1500,
    },
  ],
}
