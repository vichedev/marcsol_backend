import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

export enum PromotionLayout {
    CINEMATIC = 'CINEMATIC',
    BILLBOARD = 'BILLBOARD',
    SPOTLIGHT = 'SPOTLIGHT',
}

@Entity('promotions')
export class Promotion {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column({ type: 'text' })
    description: string;

    @Column()
    imageUrl: string;

    @Column({ nullable: true })
    ctaText: string;

    @Column({ nullable: true })
    ctaLink: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: 0 })
    displayOrder: number;

    @Column({
        type: 'enum',
        enum: PromotionLayout,
        default: PromotionLayout.CINEMATIC,
    })
    layout: PromotionLayout;

    @Column({ type: 'timestamp', nullable: true })
    startDate: Date;

    @Column({ type: 'timestamp', nullable: true })
    endDate: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
