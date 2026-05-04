import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Category } from '../categories/entities/category.entity';
import { ProductsService } from './products.service';
import { ImportResult, ImportRowError } from './dto/import-result.dto';

@Injectable()
export class ProductsImportService {
    constructor(
        @InjectRepository(Category)
        private readonly categoryRepository: Repository<Category>,
        private readonly productsService: ProductsService,
    ) { }

    async generateTemplate(imageNames: string[] = []): Promise<Buffer> {
        const categories = await this.categoryRepository.find({
            where: { isActive: true },
            order: { name: 'ASC' },
        });
        const categoryNames = categories.map((c) => c.name);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Distribuidora MarcSol';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Productos', {
            views: [{ state: 'frozen', ySplit: 2 }],
        });

        // Fila 1: instrucciones
        sheet.mergeCells('A1:G1');
        const instruction = sheet.getCell('A1');
        instruction.value =
            'Complete cada fila con un producto. Los campos con (*) son obligatorios. En la columna "imagen" usa la lista desplegable para elegir una de las imágenes que subiste previamente.';
        instruction.font = { size: 11, italic: true, color: { argb: 'FF666666' } };
        instruction.alignment = { vertical: 'middle', wrapText: true };
        sheet.getRow(1).height = 45;

        // Fila 2: encabezados
        sheet.getRow(2).values = [
            'nombre *',
            'descripcion *',
            'precio',
            'categoria *',
            'destacado',
            'activo',
            'imagen',
        ];
        sheet.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(2).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0066CC' },
        };
        sheet.getRow(2).alignment = { vertical: 'middle', horizontal: 'center' };
        sheet.getRow(2).height = 28;

        sheet.columns = [
            { width: 30 },
            { width: 45 },
            { width: 12 },
            { width: 22 },
            { width: 12 },
            { width: 10 },
            { width: 30 },
        ];

        const exampleCategory = categoryNames[0] || 'Abarrotes';
        sheet.getRow(3).values = [
            'Aceite Vegetal 1L',
            'Aceite vegetal premium, envase de 1 litro',
            3.5,
            exampleCategory,
            'SI',
            'SI',
            imageNames[0] || '',
        ];
        sheet.getRow(4).values = [
            'Arroz Blanco 5Kg',
            'Arroz blanco grado superior',
            8.9,
            exampleCategory,
            'NO',
            'SI',
            '',
        ];

        [3, 4].forEach((rowNum) => {
            const row = sheet.getRow(rowNum);
            row.font = { italic: true, color: { argb: 'FF999999' } };
            row.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFF9E6' },
            };
        });

        sheet.getCell('A3').note =
            'Esta es una fila de ejemplo. Elimínala antes de importar.';

        // Validaciones celda por celda
        for (let rowNum = 3; rowNum <= 1000; rowNum++) {
            if (categoryNames.length > 0) {
                sheet.getCell(`D${rowNum}`).dataValidation = {
                    type: 'list',
                    allowBlank: false,
                    formulae: [`"${categoryNames.join(',')}"`],
                    showErrorMessage: true,
                    errorTitle: 'Categoría inválida',
                    error: 'Selecciona una categoría de la lista desplegable.',
                };
            }

            sheet.getCell(`E${rowNum}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"SI,NO"'],
            };
            sheet.getCell(`F${rowNum}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: ['"SI,NO"'],
            };
            sheet.getCell(`C${rowNum}`).dataValidation = {
                type: 'decimal',
                operator: 'greaterThanOrEqual',
                allowBlank: true,
                formulae: [0],
                showErrorMessage: true,
                errorTitle: 'Precio inválido',
                error: 'El precio debe ser un número positivo o quedar vacío.',
            };


            // Imagen (columna G): dropdown con las imágenes ya subidas
            if (imageNames.length > 0) {
                // Excel tiene límite de ~255 caracteres en formulae inline.
                // Si hay muchas imágenes, usamos una referencia a un rango externo.
                const joined = imageNames.join(',');
                if (joined.length <= 250) {
                    // Pocas imágenes: dropdown inline
                    sheet.getCell(`G${rowNum}`).dataValidation = {
                        type: 'list',
                        allowBlank: true,
                        formulae: [`"${joined}"`],
                        showErrorMessage: true,
                        errorTitle: 'Imagen no disponible',
                        error: 'Selecciona una imagen de la lista o deja vacío.',
                    };
                } else {
                    // Muchas imágenes: referencia al rango de la hoja "Imágenes disponibles"
                    sheet.getCell(`G${rowNum}`).dataValidation = {
                        type: 'list',
                        allowBlank: true,
                        formulae: [`'Imágenes disponibles'!$A$2:$A$${imageNames.length + 1}`],
                        showErrorMessage: true,
                        errorTitle: 'Imagen no disponible',
                        error: 'Selecciona una imagen de la lista o deja vacío.',
                    };
                }
            }
        }

        // Hoja 2: categorías disponibles
        const catSheet = workbook.addWorksheet('Categorías disponibles');
        catSheet.getRow(1).values = ['Categorías que puedes usar'];
        catSheet.getRow(1).font = { bold: true, size: 14 };
        catSheet.getColumn(1).width = 35;

        categoryNames.forEach((name, idx) => {
            catSheet.getCell(`A${idx + 2}`).value = name;
        });

        if (categoryNames.length === 0) {
            catSheet.getCell('A2').value =
                'Aún no has creado categorías. Crea al menos una antes de importar.';
            catSheet.getCell('A2').font = {
                italic: true,
                color: { argb: 'FFCC0000' },
            };
        }

        // Hoja 3: imágenes disponibles (para dropdown cuando son muchas)
        const imgSheet = workbook.addWorksheet('Imágenes disponibles');
        imgSheet.getRow(1).values = ['Imágenes que subiste'];
        imgSheet.getRow(1).font = { bold: true, size: 14 };
        imgSheet.getColumn(1).width = 40;

        imageNames.forEach((name, idx) => {
            imgSheet.getCell(`A${idx + 2}`).value = name;
        });

        if (imageNames.length === 0) {
            imgSheet.getCell('A2').value =
                'No subiste imágenes. Deja vacía la columna "imagen" del Excel o vuelve al paso 1.';
            imgSheet.getCell('A2').font = {
                italic: true,
                color: { argb: 'FFCC0000' },
            };
        }

        // Hoja 3: guía de uso
        const guideSheet = workbook.addWorksheet('Cómo usar');
        guideSheet.getColumn(1).width = 90;
        guideSheet.getRow(1).values = ['Guía rápida'];
        guideSheet.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF0066CC' } };

        const guideLines = [
            '',
            '1. PASO PREVIO: Sube TODAS las imágenes en el asistente (paso 1).',
            '2. Llena esta plantilla con los datos de tus productos.',
            '3. En la columna "imagen", escribe SOLO el nombre del archivo.',
            '   Ejemplo: si subiste "aceite-1l.jpg", pon: aceite-1l.jpg',
            '4. Si un producto no tiene imagen, deja la celda vacía.',
            '5. Borra las filas de ejemplo (amarillas) antes de importar.',
            '6. Guarda el archivo como .xlsx y súbelo en el paso 3 del asistente.',
            '',
            'IMPORTANTE: El nombre del archivo en la columna "imagen" debe coincidir exactamente con el nombre del archivo que subiste (incluyendo la extensión).',
        ];

        guideLines.forEach((line, idx) => {
            const cell = guideSheet.getCell(`A${idx + 2}`);
            cell.value = line;
            cell.alignment = { wrapText: true };
            if (line.startsWith('IMPORTANTE')) {
                cell.font = { bold: true, color: { argb: 'FFCC0000' } };
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    /**
     * Procesa el Excel y crea productos.
     * imageMap: objeto con { "nombre-archivo.jpg": "/static/xxx.jpg" }
     *           Representa las imágenes subidas previamente en el paso 1.
     */
    async importFromExcel(
        fileBuffer: Buffer,
        imageMap: Record<string, string> = {},
    ): Promise<ImportResult> {
        const workbook = new ExcelJS.Workbook();
        try {
            const arrayBuffer = fileBuffer.buffer.slice(
                fileBuffer.byteOffset,
                fileBuffer.byteOffset + fileBuffer.byteLength,
            );
            await workbook.xlsx.load(arrayBuffer as ArrayBuffer);
        } catch {
            throw new BadRequestException(
                'No se pudo leer el archivo. Asegúrate de que sea un Excel (.xlsx) válido.',
            );
        }

        const sheet = workbook.getWorksheet('Productos') || workbook.worksheets[0];
        if (!sheet) {
            throw new BadRequestException('El archivo no contiene hojas.');
        }

        const categories = await this.categoryRepository.find();
        const categoryMap = new Map(
            categories.map((c) => [c.name.toLowerCase(), c]),
        );

        // Normalizar el imageMap a minúsculas para matching case-insensitive
        const normalizedImageMap = new Map<string, string>();
        for (const [key, value] of Object.entries(imageMap)) {
            normalizedImageMap.set(key.toLowerCase().trim(), value);
        }

        interface ImportRowData {
            name: string;
            description: string;
            price: number | null;
            categoryId: string;
            isFeatured: boolean;
            isActive: boolean;
            imageUrl?: string;
        }
        const rows: Array<{ rowNum: number; data: ImportRowData }> = [];
        const errors: ImportRowError[] = [];

        sheet.eachRow((row, rowNum) => {
            if (rowNum < 3) return;

            const name = this.cellString(row.getCell(1));
            const description = this.cellString(row.getCell(2));
            const priceRaw = row.getCell(3).value;
            const categoryName = this.cellString(row.getCell(4));
            const featuredRaw = this.cellString(row.getCell(5));
            const activeRaw = this.cellString(row.getCell(6));
            const imageFileName = this.cellString(row.getCell(7));

            if (!name && !description && !categoryName) return;

            const rowErrors: string[] = [];

            if (!name) rowErrors.push('El nombre es obligatorio');
            if (!description) rowErrors.push('La descripción es obligatoria');
            if (!categoryName) rowErrors.push('La categoría es obligatoria');

            const category = categoryName
                ? categoryMap.get(categoryName.toLowerCase())
                : null;
            if (categoryName && !category) {
                rowErrors.push(`La categoría "${categoryName}" no existe`);
            }

            let price: number | null = null;
            if (priceRaw !== null && priceRaw !== undefined && priceRaw !== '') {
                const p = Number(priceRaw);
                if (isNaN(p) || p < 0) {
                    rowErrors.push('El precio debe ser un número positivo');
                } else {
                    price = p;
                }
            }

            // Resolver la imagen usando el imageMap
            let imageUrl: string | undefined = undefined;
            if (imageFileName) {
                const found = normalizedImageMap.get(imageFileName.toLowerCase().trim());
                if (!found) {
                    rowErrors.push(
                        `La imagen "${imageFileName}" no se encontró entre las subidas. Verifica el nombre.`,
                    );
                } else {
                    imageUrl = found;
                }
            }

            if (rowErrors.length > 0) {
                errors.push({
                    row: rowNum,
                    name: name || undefined,
                    errors: rowErrors,
                });
                return;
            }

            rows.push({
                rowNum,
                data: {
                    name,
                    description,
                    price,
                    categoryId: category!.id,
                    isFeatured: this.parseBool(featuredRaw),
                    isActive: activeRaw ? this.parseBool(activeRaw) : true,
                    imageUrl,
                },
            });
        });

        const total = rows.length + errors.length;

        if (total === 0) {
            throw new BadRequestException(
                'El archivo no contiene filas con datos. Revisa que hayas llenado la plantilla.',
            );
        }

        if (rows.length === 0) {
            return {
                total,
                created: 0,
                failed: errors.length,
                errors,
            };
        }

        let created = 0;
        for (const { rowNum, data } of rows) {
            try {
                await this.productsService.create({
                    name: data.name,
                    description: data.description,
                    price: data.price ?? undefined,
                    categoryId: data.categoryId,
                    isFeatured: data.isFeatured,
                    isActive: data.isActive,
                    imageUrl: data.imageUrl ?? '',
                });
                created++;
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : 'Error al crear el producto';
                errors.push({
                    row: rowNum,
                    name: data.name,
                    errors: [message],
                });
            }
        }

        return {
            total,
            created,
            failed: errors.length,
            errors,
        };
    }

    // ─── Helpers ─────────────────────────────────────────────

    private cellString(cell: ExcelJS.Cell): string {
        const val = cell.value;
        if (val === null || val === undefined) return '';
        if (typeof val === 'string') return val.trim();
        if (typeof val === 'number') return String(val);
        if (typeof val === 'boolean') return val ? 'SI' : 'NO';
        if (typeof val === 'object') {
            if ('text' in val && val.text !== undefined) {
                return String((val as { text: unknown }).text).trim();
            }
            if ('richText' in val) {
                const rich = (val as { richText: Array<{ text?: string }> }).richText;
                return rich
                    .map((rt) => rt.text ?? '')
                    .join('')
                    .trim();
            }
        }
        return String(val).trim();
    }

    private parseBool(str: string): boolean {
        const normalized = str.trim().toLowerCase();
        return ['si', 'sí', 'true', '1', 'yes', 'y'].includes(normalized);
    }
}