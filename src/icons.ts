// The url of a symbol in src/assets/icons by its file name ("lock", "hp"), or undefined. Icon.vue draws them as masks;
// the pilot ID card draws them into an SVG.
const ICONS = import.meta.glob<string>('./assets/icons/*.svg', { eager: true, query: '?url', import: 'default' })
export const iconUrl = (name: string) => ICONS[`./assets/icons/${name}.svg`]
// Every file name there is, sorted, for the editor's icon choice.
export const iconNames = Object.keys(ICONS).map((path) => path.slice(path.lastIndexOf('/') + 1, -4)).sort()
