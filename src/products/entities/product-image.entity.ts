import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Product } from './product.entity';

/**
 * Imagen secundaria de un producto. La columna `Product.imageUrl` se mantiene
 * como caché de la imagen primaria para que el storefront público no necesite
 * unirse a esta tabla.
 */
@Entity('product_images')
@Index(['productId', 'sortOrder'])
export class ProductImage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    @Index()
    productId: string;

    @ManyToOne(() => Product, (product) => product.images, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'productId' })
    product: Product;

    @Column()
    url: string;

    @Column({ type: 'varchar', length: 200, nullable: true })
    alt: string | null;

    @Column({ type: 'int', default: 0 })
    sortOrder: number;

    @Column({ default: false })
    isPrimary: boolean;

    @CreateDateColumn()
    createdAt: Date;
}
