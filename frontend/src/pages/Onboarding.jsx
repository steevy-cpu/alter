import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { createAgent } from '../services/api.js'

const STEPS = ['Identity', 'Personality', 'Life', 'Future']

const INITIAL = {
  // Step 1 — Identity
  name: '',
  age: '',
  city: '',
  occupation: '',
  // Step 2 — Personality
  personality_description: '',
  strengths: ['', '', ''],
  weaknesses: ['', '', ''],
  // Step 3 — Life
  goals: '',
  fears: '',
  habits: '',
  // Step 4 — Future
  career_direction: '',
  relationship_goals: '',
  desired_future: '',
}

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(INITIAL)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const setField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const setListItem = useCallback((field, index, value) => {
    setForm((prev) => {
      const next = [...prev[field]]
      next[index] = value
      return { ...prev, [field]: next }
    })
  }, [])

  // Validate the current step before allowing the user to advance.
  const validateStep = () => {
    if (step === 0) {
      if (!form.name.trim()) return 'Your Alter needs a name.'
      if (!form.age || Number(form.age) <= 0) return 'Enter a valid age.'
      if (!form.city.trim()) return 'Where does your Alter live?'
      if (!form.occupation.trim()) return 'What does your Alter do?'
    }
    if (step === 1) {
      if (!form.personality_description.trim())
        return 'Describe your personality.'
      if (form.strengths.some((s) => !s.trim()))
        return 'List three strengths.'
      if (form.weaknesses.some((w) => !w.trim()))
        return 'List three weaknesses.'
    }
    if (step === 2) {
      if (!form.goals.trim()) return 'Share your goals and dreams.'
      if (!form.fears.trim()) return 'Share your fears.'
      if (!form.habits.trim()) return 'Describe your habits.'
    }
    if (step === 3) {
      if (!form.career_direction.trim()) return 'Describe your career direction.'
      if (!form.relationship_goals.trim())
        return 'Describe your relationship goals.'
      if (!form.desired_future.trim()) return 'Describe the future you want.'
    }
    return null
  }

  const next = () => {
    const err = validateStep()
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const back = () => {
    setError(null)
    setStep((s) => Math.max(s - 1, 0))
  }

  const submit = async () => {
    const err = validateStep()
    if (err) {
      setError(err)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const profile = {
        ...form,
        age: Number(form.age),
        strengths: form.strengths.map((s) => s.trim()).filter(Boolean),
        weaknesses: form.weaknesses.map((w) => w.trim()).filter(Boolean),
      }
      await createAgent(profile)
      navigate('/dashboard')
    } catch (e) {
      setError(e?.message || 'Could not create your Alter. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 560 }}>
        {/* Progress indicator */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-5)',
          }}
        >
          {STEPS.map((label, i) => (
            <div key={label} style={{ flex: 1 }}>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background:
                    i <= step ? 'var(--color-primary)' : 'var(--color-border)',
                  transition: 'background 180ms ease',
                }}
              />
              <span
                style={{
                  fontSize: '0.75rem',
                  color:
                    i === step
                      ? 'var(--color-text-primary)'
                      : 'var(--color-text-muted)',
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <h2 style={{ marginBottom: 'var(--space-4)' }}>
          Step {step + 1} — {STEPS[step]}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {step === 0 && (
            <>
              <Field label="Name (what your AI self will be called)">
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="e.g. Mara"
                />
              </Field>
              <Field label="Age">
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={form.age}
                  onChange={(e) => setField('age', e.target.value)}
                  placeholder="e.g. 29"
                />
              </Field>
              <Field label="City">
                <input
                  className="input"
                  value={form.city}
                  onChange={(e) => setField('city', e.target.value)}
                  placeholder="e.g. Lisbon"
                />
              </Field>
              <Field label="Occupation">
                <input
                  className="input"
                  value={form.occupation}
                  onChange={(e) => setField('occupation', e.target.value)}
                  placeholder="e.g. Graphic designer"
                />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Describe your personality">
                <textarea
                  className="input"
                  value={form.personality_description}
                  onChange={(e) =>
                    setField('personality_description', e.target.value)
                  }
                  placeholder="Curious, introverted, stubborn when it matters…"
                />
              </Field>
              <Field label="Top 3 strengths">
                <ThreeInputs
                  values={form.strengths}
                  onChange={(i, v) => setListItem('strengths', i, v)}
                  placeholder="Strength"
                />
              </Field>
              <Field label="Top 3 weaknesses">
                <ThreeInputs
                  values={form.weaknesses}
                  onChange={(i, v) => setListItem('weaknesses', i, v)}
                  placeholder="Weakness"
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Goals and dreams">
                <textarea
                  className="input"
                  value={form.goals}
                  onChange={(e) => setField('goals', e.target.value)}
                />
              </Field>
              <Field label="Fears">
                <textarea
                  className="input"
                  value={form.fears}
                  onChange={(e) => setField('fears', e.target.value)}
                />
              </Field>
              <Field label="Habits">
                <textarea
                  className="input"
                  value={form.habits}
                  onChange={(e) => setField('habits', e.target.value)}
                />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Career direction">
                <textarea
                  className="input"
                  value={form.career_direction}
                  onChange={(e) => setField('career_direction', e.target.value)}
                />
              </Field>
              <Field label="Relationship goals">
                <textarea
                  className="input"
                  value={form.relationship_goals}
                  onChange={(e) => setField('relationship_goals', e.target.value)}
                />
              </Field>
              <Field label="The future you want">
                <textarea
                  className="input"
                  value={form.desired_future}
                  onChange={(e) => setField('desired_future', e.target.value)}
                />
              </Field>
            </>
          )}
        </div>

        {error && (
          <p
            style={{
              color: 'var(--color-danger)',
              fontSize: '0.9rem',
              marginTop: 'var(--space-4)',
            }}
          >
            {error}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 'var(--space-6)',
          }}
        >
          <button
            className="btn-ghost"
            onClick={back}
            disabled={step === 0 || submitting}
            style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
          >
            Back
          </button>

          {step < STEPS.length - 1 ? (
            <button className="btn-primary" onClick={next}>
              Continue
            </button>
          ) : (
            <button className="btn-primary" onClick={submit} disabled={submitting}>
              {submitting ? 'Creating your Alter...' : 'Create your Alter'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      {children}
    </label>
  )
}

function ThreeInputs({ values, onChange, placeholder }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {values.map((v, i) => (
        <input
          key={i}
          className="input"
          value={v}
          onChange={(e) => onChange(i, e.target.value)}
          placeholder={`${placeholder} ${i + 1}`}
        />
      ))}
    </div>
  )
}
