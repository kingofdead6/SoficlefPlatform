/** Small classnames helper, mirroring src/lib/cn.ts from the source app. */
export function cn(...values) {
  return values
    .flat()
    .filter(Boolean)
    .join(' ');
}
