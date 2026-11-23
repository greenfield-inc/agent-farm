// Journey 1: Write and save a note.
const NOTE = 'Send the quarterly report'

export default {
  id: 'j01',
  slug: 'save-a-note',
  title: 'Write and save a note',
  steps: [
    { title: 'Your notes', caption: 'Your notes open on the Notes page.', target: ({ app }) => app.getByRole('heading', { name: 'Notes' }), action: 'none' },
    { title: 'Write a note', caption: 'Type your note in the box.', target: ({ app }) => app.getByRole('textbox', { name: 'New note' }), action: 'type', text: NOTE },
    { title: 'Save it', caption: 'Click Save note.', target: ({ app }) => app.getByRole('button', { name: 'Save note' }) },
    { title: 'Saved', caption: 'The note is at the top of the list.', target: ({ app }) => app.getByText(NOTE).last(), action: 'none', wait: 1200 },
  ],
}
