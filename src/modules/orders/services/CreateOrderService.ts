import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Could not find any customer with the giver id');
    }

    const existentProducts = await this.productsRepository.findAllById(
      products,
    );

    if (!existentProducts.length) {
      throw new AppError('Could not find any products with the giver ids');
    }

    const existentProductsIds = existentProducts.map(product => product.id);

    const checkInexistentProducts = products.filter(
      product => !existentProductsIds.includes(product.id),
    );

    if (checkInexistentProducts.length) {
      throw new AppError(
        `Could not find product ${checkInexistentProducts[0].id}`,
      );
    }

    const findProductsWitnNoQuantityAvailable = products.filter(
      product =>
        existentProducts.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductsWitnNoQuantityAvailable.length) {
      throw new AppError(
        `The quantity ${findProductsWitnNoQuantityAvailable[0].quantity} id not available for ${findProductsWitnNoQuantityAvailable[0].id}`,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existentProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: serializedProducts,
    });

    const { order_products } = order;

    const orderedProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        existentProducts.filter(p => p.id === product.product_id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
