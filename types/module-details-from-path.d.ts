/** Ambient declaration for the untyped `module-details-from-path` dependency. */
declare module 'module-details-from-path' {
  const detailsFromPath: (file: string) => {
    basedir: string
    name: string
    path: string
  } | undefined
  export default detailsFromPath
}
