import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

export enum AdPosition {
    HOME_TOP = 'HOME_TOP',
    HOME_MIDDLE = 'HOME_MIDDLE',
    HOME_BOTTOM = 'HOME_BOTTOM',
}

export enum BadgeColor {
    RED = 'RED',
    AMBER = 'AMBER',
    GREEN = 'GREEN',
    BLUE = 'BLUE',
    PURPLE = 'PURPLE',
    SUN = 'SUN',
}

@Entity('advertisements')
export class Advertisement {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 150 })
    title: string;

    @Column({ type: 'varchar', length: 200, nullable: true })
    subtitle: string | null;

    @Column()
    imageUrl: string;

    @Column({ type: 'varchar', length: 30, nullable: true })
    badgeText: string | null;

    @Column({
        type: 'enum',
        enum: BadgeColor,
        default: BadgeColor.SUN,
    })
    badgeColor: BadgeColor;

    @Column({ type: 'varchar', length: 50, nullable: true })
    ctaText: string | null;

    @Column({ type: 'varchar', nullable: true })
    link: string | null;

    @Column({
        type: 'enum',
        enum: AdPosition,
        default: AdPosition.HOME_MIDDLE,
    })
    position: AdPosition;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: 0 })
    displayOrder: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}