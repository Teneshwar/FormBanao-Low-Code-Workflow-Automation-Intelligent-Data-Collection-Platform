import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

interface FormData { email: string }

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>()
  const auth = useAuth()
  const [sent, setSent] = useState(false)

  const onRequest = async (data: FormData) => {
    try {
      await auth.sendPasswordReset(data.email)
      setSent(true)
      toast.success(t('auth.resetEmailSent','Password reset email sent — check your inbox'))
    } catch (err:any) {
      const msg = err?.message || String(err || '')
      toast.error(msg || t('auth.resetFailed','Failed to send reset email'))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 px-4">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-xl font-bold mb-4">{t('auth.forgotPassword','Forgot password')}</h1>

        {!sent ? (
          <>
            <p className="text-sm text-gray-500 mb-6">{t('auth.forgotPasswordHelp','Enter your email and we\'ll send a password reset link to your inbox.')}</p>
            <form onSubmit={handleSubmit(onRequest)} className="space-y-4">
              <div>
                <label className="label">{t('auth.email')}</label>
                <input type="email" className="input" {...register('email', { required: t('auth.emailRequired') as unknown as string })} />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? t('auth.sending') : t('auth.sendReset','Send reset email')}</button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-6">{t('auth.checkEmail','We\'ve sent a link to your email. Click it to reset your password and then sign in.')}</p>
            <button className="btn-secondary w-full" onClick={() => navigate('/login')}>{t('auth.backToLogin','Back to login')}</button>
          </>
        )}
      </div>
    </div>
  )
}
