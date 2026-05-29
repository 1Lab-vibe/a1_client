import styles from './SectionUnderDevelopment.module.css'

interface SectionUnderDevelopmentProps {
  title: string
}

/** Empty state when the backend did not return section data. */
export function SectionUnderDevelopment({ title }: SectionUnderDevelopmentProps) {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.stub}>
        <span className={styles.stubIcon}>!</span>
        <p>Данные раздела сейчас недоступны</p>
        <p className={styles.hint}>Обновите экран или проверьте выбранную компанию и backend workflow.</p>
      </div>
    </div>
  )
}
