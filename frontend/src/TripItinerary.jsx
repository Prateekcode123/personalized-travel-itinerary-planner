function formatCost(amount, currency) {
  const value = Number(amount)
  if (Number.isNaN(value)) {
    return `${amount} ${currency}`
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`
}

function TripItinerary({ itinerary }) {
  if (!itinerary?.days?.length) {
    return null
  }

  return (
    <section className="itinerary" aria-live="polite">
      <h2>Day-by-day itinerary</h2>
      <p className="itinerary-meta">
        {itinerary.destination} · {itinerary.source && itinerary.source !== 'demo' ? 'AI generated' : 'Demo itinerary'}
      </p>
      {itinerary.days.map((day) => (
        <article key={day.date} className="itinerary-day">
          <h3>
            Day {day.day}: {day.title}
          </h3>
          <p className="itinerary-date">{day.date}</p>
          <ol className="activity-list">
            {day.activities.map((activity, index) => (
              <li key={`${day.date}-${activity.time}-${index}`}>
                <p className="activity-time">{activity.time}</p>
                <div>
                  <h4>{activity.title}</h4>
                  <p>{activity.description}</p>
                  <p className="activity-cost">
                    Estimated cost: {formatCost(activity.estimated_cost, itinerary.currency)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </article>
      ))}
    </section>
  )
}

export default TripItinerary
