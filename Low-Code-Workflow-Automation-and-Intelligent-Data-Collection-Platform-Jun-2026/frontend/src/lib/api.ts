import axios from 'axios'

export const API_BASE = 'http://localhost:8000'

const api = axios.create({ baseURL: API_BASE })

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers = {
      ...(config.headers || {}),
      Authorization: 'Bearer ' + token,
    } as typeof config.headers
  }
  return config
})

// On 401, clear token and redirect to login
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export default api
