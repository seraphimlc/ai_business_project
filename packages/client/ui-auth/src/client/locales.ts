/** `login` namespace dictionaries for the login overlay. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'login'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'form.username': '用户名',
  'form.password': '密码',
  'form.submit': '登录',
  'error.invalidCredentials': '用户名或密码错误',
  'hint.noAccount': '未配置账号，运行 `dsh user add`',
} satisfies Record<string, string>

/** The login namespace key union. */
export type LoginKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'form.username': 'Username',
  'form.password': 'Password',
  'form.submit': 'Sign in',
  'error.invalidCredentials': 'Invalid username or password',
  'hint.noAccount': 'No account configured — run `dsh user add`',
} satisfies Record<LoginKey, string>
