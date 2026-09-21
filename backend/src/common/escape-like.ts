/** Escape ký tự đại diện của LIKE (%, _) và ký tự thoát (\) */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');
