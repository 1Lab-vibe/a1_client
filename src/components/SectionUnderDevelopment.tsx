import styles from './SectionUnderDevelopment.module.css'

interface SectionUnderDevelopmentProps {
  title: string
}

/** Заглушка при ошибке сервера: показываем, что раздел в разработке */
export function SectionUnderDevelopment({ title }: SectionUnderDevelopmentProps) {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.stub}>
        <span className={styles.stubIcon}>🔧</span>
        <p>Раздел находится в разработке</p>
        <p className={styles.hint}>Временная ошибка связи с сервером.</p>
      </div>
    </div>
  )
}
