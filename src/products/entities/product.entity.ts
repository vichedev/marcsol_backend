import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { ProductImage } from './product-image.entity';

export enum ProductStatus {
    DRAFT = 'DRAFT',
    SCHEDULED = 'SCHEDULED',
    PUBLISHED = 'PUBLISHED',
    ARCHIVED = 'ARCHIVED',
}

@Entity('products')
export class Product {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ unique: true })
    slug: string;

    @Column({ type: 'text' })
    description: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    price: number;

    /** Caché de la imagen primaria de la galería (denormalizada para el storefront). */
    @Column()
    imageUrl: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: false })
    isFeatured: boolean;

    @Column({
        type: 'enum',
        enum: ProductStatus,
        default: ProductStatus.PUBLISHED,
    })
    status: ProductStatus;

    /** Si status = SCHEDULED, fecha en que pasa automáticamente a PUBLISHED. */
    @Column({ type: 'timestamp', nullable: true })
    scheduledAt: Date | null;

    @ManyToOne(() => Category, (category) => category.products, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'categoryId' })
    category: Category;

    @Column({ nullable: true })
    categoryId: string;

    @OneToMany(() => ProductImage, (image) => image.product, {
        cascade: ['insert', 'update'],
    })
    images: ProductImage[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
