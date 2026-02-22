import styles from './Leads.module.css'

export function Leads() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Лиды</h1>
      <div className={styles.stub}>
        <span className={styles.stubIcon}>📋</span>
        <p>Раздел находится в разработке</p>
      </div>
    </div>
  )
}
