import { useEffect, useState } from 'react'
import TripItinerary from './TripItinerary.jsx'
import { supabase } from './supabase.js'

const PACE_OPTIONS = ['Relaxed', 'Balanced', 'Packed']
const INTEREST_OPTIONS = ['Food', 'Culture', 'Nature', 'Sightseeing']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD']
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const INITIAL_FORM = {
  destination: '',
  startDate: '',
  endDate: '',
  budget: '',
  currency: 'USD',
  travelers: 1,
  pace: 'Balanced',
  interests: [],
}

function validate(form) {
  const errors = {}
  const destination = form.destination.trim()

  if (!destination) {
    errors.destination = 'Destination is required.'
  }

  if (!form.startDate) {
    errors.startDate = 'Start date is required.'
  }

  if (!form.endDate) {
    errors.endDate = 'End date is required.'
  } else if (form.startDate && form.endDate < form.startDate) {
    errors.endDate = 'End date cannot be before the start date.'
  }

  const budget = Number(form.budget)
  if (form.budget === '' || Number.isNaN(budget) || budget <= 0) {
    errors.budget = 'Budget must be a positive number.'
  }

  const travelers = Number(form.travelers)
  if (!Number.isInteger(travelers) || travelers < 1) {
    errors.travelers = 'Number of travelers must be at least 1.'
  }

  return errors
}

function formatApiError(payload, status) {
  if (typeof payload?.detail === 'string') {
    return payload.detail
  }
  if (Array.isArray(payload?.detail)) {
    return payload.detail
      .map((item) => item.msg || item.message)
      .filter(Boolean)
      .join(' ')
  }
  return `Could not generate an itinerary (${status}).`
}

function TripPreferenceForm({ user }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [itinerary, setItinerary] = useState(null)
  const [savedTrips, setSavedTrips] = useState([])
  const [savedTripsLoading, setSavedTripsLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [savedTripsMessage, setSavedTripsMessage] = useState('')

  useEffect(() => {
    let active = true

    async function loadSavedTrips() {
      setSavedTripsMessage('')
      if (!user) {
        setSavedTrips([])
        return
      }

      setSavedTripsLoading(true)
      const { data, error } = await supabase
        .from('trips')
        .select('id, destination, start_date, end_date, budget, travelers, preferences, itinerary, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (!active) return
      if (error) {
        setSavedTripsMessage(`Could not load saved trips: ${error.message}`)
      } else {
        setSavedTrips(data ?? [])
      }
      setSavedTripsLoading(false)
    }

    loadSavedTrips()
    return () => { active = false }
  }, [user])

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function toggleInterest(interest) {
    setForm((current) => {
      const selected = current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest]
      return { ...current, interests: selected }
    })
  }

  async function saveTrip() {
    if (!user || !itinerary) return
    setSaveLoading(true)
    setSavedTripsMessage('')

    const trip = {
      user_id: user.id,
      destination: form.destination.trim(),
      start_date: form.startDate,
      end_date: form.endDate,
      budget: Number(form.budget),
      travelers: Number(form.travelers),
      preferences: {
        currency: form.currency,
        pace: form.pace,
        interests: form.interests,
      },
      itinerary,
    }

    const { data, error } = await supabase
      .from('trips')
      .insert(trip)
      .select('id, destination, start_date, end_date, budget, travelers, preferences, itinerary, created_at')
      .single()

    if (error) {
      setSavedTripsMessage(`Could not save trip: ${error.message}`)
    } else {
      setSavedTrips((current) => [data, ...current])
      setSavedTripsMessage('Trip saved successfully.')
    }
    setSaveLoading(false)
  }

  function openSavedTrip(trip) {
    const preferences = trip.preferences ?? {}
    setForm({
      destination: trip.destination ?? '',
      startDate: trip.start_date ?? '',
      endDate: trip.end_date ?? '',
      budget: String(trip.budget ?? ''),
      currency: preferences.currency ?? 'USD',
      travelers: trip.travelers ?? 1,
      pace: preferences.pace ?? 'Balanced',
      interests: Array.isArray(preferences.interests) ? preferences.interests : [],
    })
    setItinerary(trip.itinerary ?? null)
    setErrors({})
    setRequestError('')
    setSavedTripsMessage(`Loaded trip to ${trip.destination}.`)
  }

  function exportItinerary() {
    if (!itinerary) return

    const exportData = {
      trip: {
        destination: form.destination,
        start_date: form.startDate,
        end_date: form.endDate,
        budget: Number(form.budget),
        currency: form.currency,
        travelers: Number(form.travelers),
        preferences: { pace: form.pace, interests: form.interests },
      },
      itinerary,
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safeDestination = form.destination.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
    link.href = url
    link.download = `${safeDestination || 'trip'}-itinerary.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validate(form)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      setItinerary(null)
      setRequestError('')
      return
    }

    setLoading(true)
    setRequestError('')
    setItinerary(null)

    try {
      const response = await fetch(`${API_URL}/api/trips/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: form.destination.trim(),
          start_date: form.startDate,
          end_date: form.endDate,
          budget: Number(form.budget),
          currency: form.currency,
          travelers: Number(form.travelers),
          pace: form.pace,
          interests: form.interests,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(formatApiError(payload, response.status))
      }
      setItinerary(payload)
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : 'Could not generate an itinerary. Check that the backend is running.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <form className="trip-form" onSubmit={handleSubmit} noValidate>
        <fieldset>
          <legend>Trip details</legend>

          <label htmlFor="destination">Destination</label>
          <input
            id="destination"
            name="destination"
            type="text"
            value={form.destination}
            onChange={(event) => updateField('destination', event.target.value)}
            placeholder="City, region, or country"
            aria-invalid={Boolean(errors.destination)}
            aria-describedby={errors.destination ? 'destination-error' : undefined}
          />
          {errors.destination ? (
            <p id="destination-error" className="field-error">
              {errors.destination}
            </p>
          ) : null}

          <div className="field-row">
            <div>
              <label htmlFor="startDate">Start date</label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                value={form.startDate}
                onChange={(event) => updateField('startDate', event.target.value)}
                aria-invalid={Boolean(errors.startDate)}
                aria-describedby={errors.startDate ? 'startDate-error' : undefined}
              />
              {errors.startDate ? (
                <p id="startDate-error" className="field-error">
                  {errors.startDate}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="endDate">End date</label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                value={form.endDate}
                onChange={(event) => updateField('endDate', event.target.value)}
                aria-invalid={Boolean(errors.endDate)}
                aria-describedby={errors.endDate ? 'endDate-error' : undefined}
              />
              {errors.endDate ? (
                <p id="endDate-error" className="field-error">
                  {errors.endDate}
                </p>
              ) : null}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Budget and travelers</legend>

          <div className="field-row">
            <div>
              <label htmlFor="budget">Budget</label>
              <input
                id="budget"
                name="budget"
                type="number"
                min="1"
                step="1"
                value={form.budget}
                onChange={(event) => updateField('budget', event.target.value)}
                aria-invalid={Boolean(errors.budget)}
                aria-describedby={errors.budget ? 'budget-error' : undefined}
              />
              {errors.budget ? (
                <p id="budget-error" className="field-error">
                  {errors.budget}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="currency">Currency</label>
              <select
                id="currency"
                name="currency"
                value={form.currency}
                onChange={(event) => updateField('currency', event.target.value)}
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label htmlFor="travelers">Number of travelers</label>
          <input
            id="travelers"
            name="travelers"
            type="number"
            min="1"
            step="1"
            value={form.travelers}
            onChange={(event) => updateField('travelers', event.target.value)}
            aria-invalid={Boolean(errors.travelers)}
            aria-describedby={errors.travelers ? 'travelers-error' : undefined}
          />
          {errors.travelers ? (
            <p id="travelers-error" className="field-error">
              {errors.travelers}
            </p>
          ) : null}
        </fieldset>

        <fieldset>
          <legend>Travel pace</legend>
          <div className="choice-list">
            {PACE_OPTIONS.map((option) => (
              <label key={option} className="choice">
                <input
                  type="radio"
                  name="pace"
                  value={option}
                  checked={form.pace === option}
                  onChange={(event) => updateField('pace', event.target.value)}
                />
                {option}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Interests</legend>
          <div className="choice-list">
            {INTEREST_OPTIONS.map((interest) => (
              <label key={interest} className="choice">
                <input
                  type="checkbox"
                  name="interests"
                  value={interest}
                  checked={form.interests.includes(interest)}
                  onChange={() => toggleInterest(interest)}
                />
                {interest}
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" disabled={loading}>
          {loading ? 'Generating itinerary…' : 'Generate itinerary'}
        </button>

        {loading ? (
          <p className="form-status" role="status">
            Building a day-by-day plan…
          </p>
        ) : null}

        {requestError ? (
          <p className="form-status field-error" role="alert">
            {requestError}
          </p>
        ) : null}
      </form>

      {itinerary && user ? (
        <button type="button" onClick={saveTrip} disabled={saveLoading}>
          {saveLoading ? 'Saving trip…' : 'Save trip'}
        </button>
      ) : null}

      {user ? (
        <section className="saved-trips">
          <h2>My saved trips</h2>
          {savedTripsLoading ? <p>Loading saved trips…</p> : null}
          {!savedTripsLoading && savedTrips.length === 0 ? <p>No trips saved yet.</p> : null}
          {savedTrips.map((trip) => (
            <button
              className="saved-trip-button"
              type="button"
              key={trip.id}
              onClick={() => openSavedTrip(trip)}
            >
              {trip.destination} · {trip.start_date}
            </button>
          ))}
        </section>
      ) : null}
      {savedTripsMessage ? <p className="form-status" role="status">{savedTripsMessage}</p> : null}

      {itinerary ? (
        <div className="export-actions">
          <button type="button" onClick={exportItinerary}>Download itinerary (JSON)</button>
          <button type="button" onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      ) : null}

      <TripItinerary itinerary={itinerary} />
    </>
  )
}

export default TripPreferenceForm
