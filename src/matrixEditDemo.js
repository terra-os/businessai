export default function () {
  return [
    [
      [
        `# The Orders Service

Services 
1 - auth - Everything related to user signup/signin/signout 
2 - tickets - Ticket creation/editing. Knows whether a ticket can be updated 
3 - orders - Order creation/editing 
4 - expiration - Watches for orders to be created, cancels them after 15 minutes 
5 - payments - Handles credit card payments. Cancels orders if payments fails, 
completes if payment succeeds

- Tickets Service Orders Service Ticket Prop Type title Title of event this ticket is for price Price of the ticket in USD userId ID of the user who is selling this ticket Order Prop Type userId User who created this order and is trying to buy a ticket status Whether the order is expired, paid, or pending expiresAt Time at which this order expires (user has 15 mins to pay) ticketId ID of the ticket the user is trying to buy Ticket Prop Type Event ticket:created Event ticket:updated version Version of this ticket. Increment every time this ticket is changed title Title of event this ticket is for price Price of the ticket in USD version Ensures that we don't process events twice or out of order


`,`
---

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2026.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2025.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2024.png")`,
      ], [
        `# Orders Service Setup

1 - Duplicate the 'tickets' service
2 - Install dependencies / $ orders % npm install
3 - Build a docker image out of the orders service % docker build -t stefian22/orders .
4 - Create a Kubernetes deployment file / orders-depl.yaml, orders-mongo-depl.yaml
5 - Set up file sync options in the skaffold.yaml file

    - image: stefian22/orders # or for GCP: us.gcr.io/aibazar-dev/orders
      context: orders
      docker:
        dockerfile: Dockerfile
      sync:
        manual:
          - src: "src/**/*.ts"
            dest: .

6 - Set up routing rules in the ingress service # ToDo next
`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2027.png")`,
      ], [
        `# Cont. Set up Orders Service 

- 
`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2028.png")`,
      ], [
        `# Set up routing rules in the ingress service 

- orders service Routes
Method Route Body Purpose
- GET /api/orders - Retrieve all active orders for the given user making the request 
- GET /api/orders/:id - Get details about a specific order
- POST /api/orders { ticketId: string } - Create an order to purchase the specified ticket
- DELETE /api/orders/:id - Cancel the order

- 
`,`ingress-srv.yaml
---
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: ingress-service
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/use-regex: "true"
spec:
  rules:
    - host: aibazar.dev
      http:
        paths:
          - path: /api/users/?(.*)
            backend:
              serviceName: auth-srv
              servicePort: 3000
          - path: /api/tickets/?(.*)
            backend:
              serviceName: tickets-srv
              servicePort: 3000
          - path: /api/orders/?(.*)
            backend:
              serviceName: orders-srv
              servicePort: 3000
          - path: /?(.*)
            backend:
              serviceName: client-srv
              servicePort: 3000

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2029.png")`,
    
      ], [
        `# Orders Route Handlers

orders service Routes
Method Route Body Purpose
- GET /api/orders - Retrieve all active orders for the given user making the request 
- GET /api/orders/:id - Get details about a specific order
- POST /api/orders { ticketId: string } - Create an order to purchase the specified ticket
- DELETE /api/orders/:id - Cancel the order

- Copy files from tickets / modify update => delete.ts

NOTE / COGITO : in Cogito Orders = Projects !!!
  - and projects can be updated !!!
  - Projects shouldn't be deleted but archived !!! via updating status ?!
  => added also an update.ts 

- 




`,`orders/src/app.ts
---
import express from "express";
import "express-async-errors";
import { json } from "body-parser";
import cookieSession from "cookie-session";
import {
  errorHandler,
  NotFoundError,
  currentUser,
} from "@w3ai/common";

import { deleteOrderRouter } from "./routes/delete";
import { indexOrderRouter } from "./routes/index";
import { newOrderRouter } from "./routes/new";
import { showOrderRouter } from "./routes/show";
import { updateOrderRouter } from "./routes/update";

const app = express();
app.set("trust proxy", true); // to allow traffic through ingress-nginx
app.use(json());
app.use(
  cookieSession({
    signed: false,
    secure: process.env.NODE_ENV !== "test", // to ensure it will always work on https connection or http for testing
  })
);
app.use(currentUser);

app.use(deleteOrderRouter);
app.use(indexOrderRouter);
app.use(newOrderRouter);
app.use(showOrderRouter);
app.use(updateOrderRouter);
---`,`orders/src/routes/index.ts
---
import express, { Request, Response } from "express";

const router = express.Router();

router.get("/api/orders", async (req: Request, res: Response) => {
  res.send({});
});

export { router as indexOrderRouter };

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2031.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2029.png")`,
    
      ], [
        `# Subtle Service Coupling with the Tickets service

- if assuming and validating that the ticket id has the structure of a mongodb id
  - the ticket service might use a diff db in the future

- we are adding though a check to validate that the ticket id looks like a mongo id


`,`orders/src/routes/new.ts
---
import mongoose from "mongoose";
import express, { Request, Response } from "express";
import { requireAuth, validateRequest } from "@w3ai/common";
import { body } from "express-validator";

const router = express.Router();

router.post(
  "/api/orders",
  requireAuth,
  [
    body("ticketId")
      .not()
      .isEmpty()
      .custom((input: string) =>
        mongoose.Types.ObjectId.isValid(input)
      )
      .withMessage("TicketId must be provided"),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    res.send({});
  }
);

export { router as newOrderRouter };

---`,
    
      ], [
        `# Associating Orders and Tickets

- Building an order model to describe what an order is and how to save it to the 
service db 
together with the associated ticket

- We need to mark a ticket as reserved / associated with a particular order

- 2 ways / strategies to do this with mongodb / mongoose:
  Option 1 - Embedding tickets into orders - plain obj inside the order {id: , price: , title: }
      - Con 1 - Querying is just a bit challenging - need to check all orders to see if ticket
                     is not already reserved ...
      - Con 2 - We still need to implement a Pool of records inside Orders db to store
                     tickets not associated with an order / unreserved yet

  Option 2 - Using Ref / Population feature in Mongoose / mongo << To Implement
             - we'll have 2 collections: orders and tickets
             - inside every order, optionally there could be a reference to a ticket`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2032.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2036.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2035.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2034.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2033.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2025.png")`,
    
      ], [
        `# Order Model Setup

- Whenever we need to have Mongoose and TS to work together we need to implement
  3 interfaces in the model: ~ same as in auth / user model file : 
    a - describe the props to create a user / record / order
    b - describe the props of the overall mongoose model / object has 
         - includes the build method :

  interface UserModel extends mongoose.Model<UserDoc> {
    build(attrs: UserAttrs): UserDoc;
  }

    c - describe the props of a Mongo Doc 

- all these interfaces are to allow typescript to do validation / type checking on 
  the arguments we use to create a new doc

- `,`orders/src/models/order.ts
---
import mongoose, { Mongoose } from "mongoose";

interface OrderAttrs {
  userId: string;
  status: string;
  expiresAt: Date;
  ticket: TicketDoc;
}

interface OrderDoc extends mongoose.Document {
  userId: string;
  status: string;
  expiresAt: Date;
  ticket: TicketDoc;
}

interface OrderModel extends mongoose.Model<OrderDoc> {
  build(attrs: OrderAttrs): OrderDoc;
}
---`,`orders/src/models/order.ts
---
const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: mongoose.Schema.Types.Date,
    },
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
    },
  },
  {
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
      },
    },
  }
);

orderSchema.statics.build = (attrs: OrderAttrs) => {
  return new Order(attrs);
};

const Order = mongoose.model<OrderDoc, OrderModel>(
  "Order",
  orderSchema
);

export { Order };

---`,
    
      ], [
        `# Defining the Status of an Order

- Orders Service Expiration Service Payments Service 
Need a shared and exact definition of the different statuses an order can have!

- Solution: Defining the OrderStatus in the Common Library and 
  Share it among the different Services

- enum OrderStatus to list 
`,`
---

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2043.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2041.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2040.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2039.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2038.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2037.png")`,
    
      ], [
        `# Creating an OrderStatus Enum

- Cancelled is a kind of Catch All status => can be split in 3 to provide more info as of 
  why it was cancelled ... we won't do it now

- But might be important to define / detail for Cogito's Market tx states 

- $ common % npm run pub  

- cd ..

cd orders

$ orders % npm update @w3ai/common

- Cmd + Shift + P > Reload Window

- 


`,`common/src/events/types/order-status.ts
---
export enum OrderStatus {
  // When the order has beeb created, but the
  // ticket it is trying to order has not been reserved
  Created = "created",

  // The ticket the order is trying to reserve has already
  // been reserved, or when the user has cancelled the order.
  // The order expires before payment
  Cancelled = "cancelled",

  // The order has successfully reserved the ticket
  AwaitingPayment = "awaiting:payment",

  // The order has reserved the ticket and the user has
  // provided payment successfully
  Complete = "complete",
}

---`,`common/src/index.ts
---
// Export errors and middlewares initially in market auth
export * from "./errors/bad-request-error";
export * from "./errors/custom-error";
export * from "./errors/database-connection-error";
export * from "./errors/not-authorized-error";
export * from "./errors/not-found-error";
export * from "./errors/request-validation-error";

export * from "./middlewares/current-user";
export * from "./middlewares/error-handler";
export * from "./middlewares/require-auth";
export * from "./middlewares/validate-request";

export * from "./events/base-listener";
export * from "./events/base-publisher";
export * from "./events/subjects";
export * from "./events/ticket-created-event";
export * from "./events/ticket-updated-event";
export * from "./events/types/order-status";

---`,
    
      ]
    ],
    [
      [
        `# Mongoose Refs

- Need to Create a Ticket Model for the tickets inside the Order service

- these tickets will be referenced through the ref / population feature in mongoose

=> 1 -  Create / Save Order + Ticket

=> 2 -  Associate an existing Ticket with a new Order

=> 3 -  Fetch and reference an exisiting Order and its associated Ticket
`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2047.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2049.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2048.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2050.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2052.png")`,
    
      ], [
        `# Defining the Ticket Model / Data Layer for the Order Service

- Import mongoose and define the 3 TS / Mongoose interfaces

import mongoose from 'mongoose';

interface TicketAttrs {

}

interface TicketDoc extends mongoose.Document {

}

interface TicketModel extends mongoose.Model<TicketDoc> {
  
}

=> Replication of Data between services !!! 
  => is there opportunity for a common shared library ? =>> No ! Don't !

- this could be very specific for this service
  - with attributes just for the Orders service needs to work correctly
  - there might be other attributes saved in the db of the Tickets Service
    that are not relevent for the Orders service
  - Orders Service only needs : Ticket Title, Price, Version and ticketId

=> Definetly we need different defs between Ordrs and Tickets 
  even if largely overlapping and redundant

- Also Orders might grow to incapsulate things that can be ordered / purchased 
  that are not tickets !!! - eg: Services / Tasks / CMDs / for Cogito Markets / PMOs
  - or Parking services
`,`orders/src/models/ticket.ts
---
import mongoose from "mongoose";

interface TicketAttrs {
  title: string;
  price: number;
}

export interface TicketDoc extends mongoose.Document {
  title: string;
  price: number;
}

interface TicketModel extends mongoose.Model<TicketDoc> {
  build(attrs: TicketAttrs): TicketDoc;
}

---`,`orders/src/models/ticket.ts
---
const ticketSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
      },
    },
  }
);

ticketSchema.statics.build = (attrs: TicketAttrs) => {
  return new Ticket(attrs);
};

const Ticket = mongoose.model<TicketDoc, TicketModel>(
  "Ticket",
  ticketSchema
);

export { Ticket };
---`,`Order Service data structures :

Tickets Service Orders Service Ticket Prop Type title Title of event this ticket is for price Price of the ticket in USD userId ID of the user who is selling this ticket Order Prop Type userId User who created this order and is trying to buy a ticket status Whether the order is expired, paid, or pending expiresAt Time at which this order expires (user has 15 mins to pay) ticketId ID of the ticket the user is trying to buy Ticket Prop Type version Version of this ticket. Increment every time this ticket is changed title Title of event this ticket is for price Price of the ticket in USD version Ensures that we don't process events twice or out of order ticket:updated { id: 'abc', price: 10, version: 2 } ticket:updated { id: 'abc', price: 20, version: 3 } ticket:updated { id: 'abc', price: 30, version: 4 }`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2054.png")`,
    
      ], [
        `# Planning the tasks for the Order Creation Logic

    // Find the ticket the user is trying to order in the database

    // Make sure that this ticket is not already reserved - Many users might try to buy the same ticket at the same time

    // calculate an expiration date for this order

    // Build the order and save it to the database

    // Publish an event saying that an order was created
`,`orders/src/routes/new.ts
---
  async (req: Request, res: Response) => {
    const { ticketId } = req.body;

    // Find the ticket the user is trying to order in the database
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError();
    }

    // Make sure that this ticket is not already reserved - Many users might try to buy the same ticket at the same time

    // calculate an expiration date for this order

    // Build the order and save it to the database

    // Publish an event saying that an order was created

    res.send({});
  }

---`,
    
      ], [
        `# Finding Reserved Tickets

- Find the order - not cancelled where the ticket we try to reserve

- use mongodb operator : $in :

    // Make sure that this ticket is not already reserved 
      - Many users might try to buy the same ticket at the same time
    // Run query to look at all orders. Find an order where the ticket
    // is the ticket we just found *and* the orders status is *not* cancelled.
    // If we find an order from that means the ticket *is* reserved
    const existingOrder = await Order.findOne({
      ticket: ticket,
      status: {
        $in: [
          OrderStatus.Created,
          OrderStatus.AwaitingPayment,
          OrderStatus.Complete
        ]
      }
    });
    if (existingOrder) {
      throw new BadRequestError('Ticket is already reserved');
    }
`,`new.ts
---
    // Make sure that this ticket is not already reserved - Many users might try to buy the same ticket at the same time
    // Run query to look at all orders. Find an order where the ticket
    // is the ticket we just found *and* the orders status is *not* cancelled.
    // If we find an order from that means the ticket *is* reserved
    const existingOrder = await Order.findOne({
      ticket: ticket,
      status: {
        $in: [
          OrderStatus.Created,
          OrderStatus.AwaitingPayment,
          OrderStatus.Complete
        ]
      }
    });
    if (existingOrder) {
      throw new BadRequestError('Ticket is already reserved');
    }
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2056.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2055.png")`,
    
      ], [
        `# Refactor Finding Existing Order logic 

- build isReserved() method in the TicketDoc interface : - to reduce / re-use code :

export interface TicketDoc extends mongoose.Document {
  title: string;
  price: number;
  isReserved(): Promise<boolean>; // ~ isBooked(), isScheduled(), isPlanned()
}

- 
`,`models/ticket.ts
---
ticketSchema.statics.build = (attrs: TicketAttrs) => {
  return new Ticket(attrs);
};
ticketSchema.methods.isReserved = async function () {
  // use function keyword in order to be able to use 'this' inside
  const existingOrder = await Order.findOne({
    ticket: this,
    status: {
      $in: [
        OrderStatus.Created,
        OrderStatus.AwaitingPayment,
        OrderStatus.Complete,
      ],
    },
  });

  return !!existingOrder; // to return a boolean as per def
};

const Ticket = mongoose.model<TicketDoc, TicketModel>(
  "Ticket",
  ticketSchema
);

export { Ticket };

---`,`orders/src/routes/new.ts
---
async (req: Request, res: Response) => {
    const { ticketId } = req.body;

    // Find the ticket the user is trying to order in the database
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError();
    }

    // Make sure that this ticket is not already reserved - Many users might try to buy the same ticket at the same time
    // Run query to look at all orders. Find an order where the ticket
    // is the ticket we just found *and* the orders status is *not* cancelled.
    // If we find an order from that means the ticket *is* reserved
    const isReserved = await ticket.isReserved();
    if (isReserved) {
      throw new BadRequestError("Ticket is already reserved");
    }

    // calculate an expiration date for this order

    // Build the order and save it to the database

    // Publish an event saying that an order was created

    res.send({});
  }
---`,
    
      ], [
        `# Calculate an Expiration Time for the Order

- const EXPIRATION_WINDOW_SECONDS = 15 * 60; // 15mins in seconds

- Move const to an Environment var to not have to re-deploy on change !!!

- Or even fancier - Put it in the DB to allow the admin to change it on the fly !!!

- You can have !!! Per user Expiration Settings !!! <<< ToDo for Cogito !!! 

- 
`,`new.ts
---
  async (req: Request, res: Response) => {
    const { ticketId } = req.body;

    // Find the ticket the user is trying to order in the database
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError();
    }

    // Make sure that this ticket is not already reserved - Many users might try to buy the same ticket at the same time
    const isReserved = await ticket.isReserved();
    if (isReserved) {
      throw new BadRequestError("Ticket is already reserved");
    }

    // calculate an expiration date for this order
    const expiration = new Date(); // = Now - Current Date/Time
    expiration.setSeconds(
      expiration.getSeconds() + EXPIRATION_WINDOW_SECONDS
    );

    // Build the order and save it to the database
    const order = Order.build({
      userId: req.currentUser!.id,
      status: OrderStatus.Created,
      expiresAt: expiration,
      ticket,
    });
    await order.save();

    // Publish an event saying that an order was created

    res.status(201).send(order);
---`,
    
      ], [
        `# Test Suite Setup for Orders Service

- Copy test/setup from tickets dir

- Cmd + Shift + P - Reload VSCode window

- Copy __mocks__ folder from tickets
`,`
---

---`,
    
      ], [
        `# Asserting Tickets Exist test

- Tests :
  - user tries to reserve a ticket that dos not exist
  - user tries to reserve a ticket already reserved
  - test the successfully reserving a ticket

- we need to prep tickets in db to ensure tests work ...

- 
`,`new.test.ts
---
import mongoose from "mongoose";
import request from "supertest";
import { app } from "../../app";

it("returns an error if the ticket does not exist", async () => {
  const ticketId = mongoose.Types.ObjectId();

  await request(app)
    .post("/api/orders")
    .set("Cookie", global.signin())
    .send({ ticketId })
    .expect(404);
});

it("returns an error if the ticket is already reserved", async () => {});

it("reserves a ticket", async () => {});

---`,
    
      ], [
        `# Testing / Asserting Reserved Tickets

- 
`,`new.test.ts
---
it("returns an error if the ticket is already reserved", async () => {
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();
  const order = Order.build({
    ticket,
    userId: "randomUserId",
    status: OrderStatus.Created,
    expiresAt: new Date(),
  });
  await order.save();

  await request(app)
    .post("/api/orders")
    .set("Cookie", global.signin())
    .send({ ticketId: ticket.id })
    .expect(400);
});
---`,
    
      ], [
        `# Testing the New Order Created Successfully case

- 
`,`new.test.ts
---
it("reserves a ticket", async () => {
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  await request(app)
    .post("/api/orders")
    .set("Cookie", global.signin())
    .send({ ticketId: ticket.id })
    .expect(201);
});
---`,
    
      ]
    ],
    [
      [
        `# Fetching a User's Orders

- implement all routes before implementing the messaging through the event bus

- Adding ToDos in test files :
  it.todo("emits an order created event");


`,`orders/scr/routes/index.ts
---
import express, { Request, Response } from "express";
import { requireAuth } from "@w3ai/common";
import { Order } from "../models/order";

const router = express.Router();

router.get(
  "/api/orders",
  requireAuth,
  async (req: Request, res: Response) => {
    const orders = await Order.find({
      userId: req.currentUser!.id,
    }).populate("ticket");

    res.send(orders);
  }
);

export { router as indexOrderRouter };

---`,`new.test.ts
---
it.todo("emits an order created event");
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2057.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2058.png")`,
    
      ], [
        `# Testing the index route

- Comments to guide the coding:

  // Create 3 tickets

  // Create 1 order as User #1

  // Create 2 orders as User #2

  // Make request to get orders for User #2

  // Make sure we only got the orders for User #2

- helper function for building a ticket : 

const buildTicket = async () => {
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  return ticket;
};

- COGITO: ToDo: Define Accelerate / Amplify factor 
  ~ nr. characters (function implementation) / nr characters (command)

  eg: 152 / 11 = 13.81  // for the buildTicket above
`,`index.test.ts
---
import request from "supertest";
import { app } from "../../app";
import { Order } from "../../models/order";
import { Ticket } from "../../models/ticket";

const buildTicket = async () => {
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  return ticket;
};

it("fetches orders for a particular user", async () => {
  // Create 3 tickets
  const ticketOne = await buildTicket();
  const ticketTwo = await buildTicket();
  const ticketThree = await buildTicket();

  // Create 1 order as User #1
  // Create 2 orders as User #2
  // Make request to get orders for User #2
  // Make sure we only got the orders for User #2
});

---`,`index.test.ts
---
import request from "supertest";
import { app } from "../../app";
import { Order } from "../../models/order";
import { Ticket } from "../../models/ticket";

const buildTicket = async () => {
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  return ticket;
};

it("fetches orders for a particular user", async () => {
  // Create 3 tickets
  const ticketOne = await buildTicket();
  const ticketTwo = await buildTicket();
  const ticketThree = await buildTicket();

  const userOne = global.signin();
  const userTwo = global.signin();
  // Create 1 order as User #1
  await request(app)
    .post("/api/orders")
    .set("Cookie", userOne)
    .send({ ticketId: ticketOne.id })
    .expect(201);

  // Create 2 orders as User #2
  const { body: orderOne } = await request(app)
    .post("/api/orders")
    .set("Cookie", userTwo)
    .send({ ticketId: ticketTwo.id })
    .expect(201);
  const { body: orderTwo } = await request(app)
    .post("/api/orders")
    .set("Cookie", userTwo)
    .send({ ticketId: ticketThree.id })
    .expect(201);

  // Make request to get orders for User #2
  const response = await request(app)
    .get("/api/orders")
    .set("Cookie", userTwo)
    .expect(200);

  // Make sure we only got the orders for User #2
  expect(response.body.length).toEqual(2);
  expect(response.body[0].id).toEqual(orderOne.id);
  expect(response.body[1].id).toEqual(orderTwo.id);
  expect(response.body[0].ticket.id).toEqual(ticketTwo.id);
  expect(response.body[1].ticket.id).toEqual(ticketThree.id);
});

---`,`const buildTicket = async () => {
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  return ticket;
};`,`152=LEN(G372)`,`13.818181818181818=152/11`,
    
      ], [
        `# Implementing Show Request Handler

- 
`,`orders/src/routes/show.ts
---
import express, { Request, Response } from "express";
import {
  requireAuth,
  NotFoundError,
  NotAuthorizedError,
} from "@w3ai/common";
import { Order } from "../models/order";

const router = express.Router();

router.get(
  "/api/orders/:orderId",
  requireAuth,
  async (req: Request, res: Response) => {
    const order = await Order.findById(req.params.orderId).populate(
      "ticket"
    );

    if (!order) {
      throw new NotFoundError();
    }
    if (order.userId !== req.currentUser!.id) {
      throw new NotAuthorizedError();
    }

    res.send(order);
  }
);

export { router as showOrderRouter };

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2060.png")`,
    
      ], [
        `# Test script for show.ts / show specific order

- 
`,`show.test.ts
---
import request from "supertest";
import { app } from "../../app";
import { Ticket } from "../../models/ticket";

it("fetches the order", async () => {
  // Create a ticket
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  const user = global.signin();
  // Make a request to build an order with this ticket
  const { body: order } = await request(app)
    .post("/api/orders")
    .set("Cookie", user)
    .send({ ticketId: ticket.id })
    .expect(201);

  // Make request to fetch the order
  const { body: fetchedOrder } = await request(app)
    //.get(\`/api/orders/\${order.id}\`)
    .set("Cookie", user)
    .send()
    .expect(200);

  expect(fetchedOrder.id).toEqual(order.id);
});

it("returns an error if one user tries to fetch another users order", async () => {
  // Create a ticket
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  const user = global.signin();
  // Make a request to build an order with this ticket
  const { body: order } = await request(app)
    .post("/api/orders")
    .set("Cookie", user)
    .send({ ticketId: ticket.id })
    .expect(201);

  // Make request to fetch the order
  await request(app)
    //.get(\`/api/orders/\${order.id}\`)
    .set("Cookie", global.signin())
    .send()
    .expect(401);
});

---`,`show.test.ts
---
import request from "supertest";
import { app } from "../../app";
import { Ticket } from "../../models/ticket";

it("fetches the order", async () => {
  // Create a ticket
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  const user = global.signin();
  // Make a request to build an order with this ticket
  const { body: order } = await request(app)
    .post("/api/orders")
    .set("Cookie", user)
    .send({ ticketId: ticket.id })
    .expect(201);

  // Make request to fetch the order
  const { body: fetchedOrder } = await request(app)
    //.get(\`/api/orders/\${order.id}\`)
    .set("Cookie", user)
    .send()
    .expect(200);

  expect(fetchedOrder.id).toEqual(order.id);
});

---`,
    
      ], [
        `# Cancelling the Order

- We won't cancel the order - we'll just change status to Cancelled

- 
`,`orders/src/routes/delete.ts
---
import express, { Request, Response } from "express";
import {
  requireAuth,
  NotFoundError,
  NotAuthorizedError,
} from "@w3ai/common";
import { Order, OrderStatus } from "../models/order";

const router = express.Router();

router.delete(
  "/api/orders/:orderId",
  requireAuth,
  async (req: Request, res: Response) => {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);

    if (!order) {
      throw new NotFoundError();
    }
    if (order.userId !== req.currentUser!.id) {
      throw new NotAuthorizedError();
    }
    order.status = OrderStatus.Cancelled;
    await order.save();

    res.status(204).send(order); // 204 - record deleted
  }
);

export { router as deleteOrderRouter };

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2062.png")`,
    
      ], [
        `# Testing Deleting Order

- Comments to guide Coding the test:

  // create a ticket with Ticket model
  
  // make a request to create an order

  // make a request to cancel the order

  // expectation to make sure the thing is cancelled

`,`delete.test.ts
---
import request from "supertest";
import { app } from "../../app";
import { Ticket } from "../../models/ticket";
import { Order, OrderStatus } from "../../models/order";

it("marks an order as cancelled", async () => {
  // create a ticket with Ticket model
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  const user = global.signin();
  // make a request to create an order
  const { body: order } = await request(app)
    .post("/api/orders")
    .set("Cookie", user)
    .send({ ticketId: ticket.id })
    .expect(201);

  // make a request to cancel the order
  await request(app)
    //.delete(\`/api/orders/\${order.id}\`)
    .set("Cookie", user)
    .send()
    .expect(204);

  // expectation to make sure the thing is cancelled
  const updatedOrder = await Order.findById(order.id);

  expect(updatedOrder!.status).toEqual(OrderStatus.Cancelled);
});

it.todo("emits an order cancelled event");
---`,`delete.test.ts
---
import request from 'supertest';
import { app } from '../../app';
import { Ticket } from '../../models/ticket';

it('marks an order as cancelled', async () => {
  // create a ticket with Ticket model
  
  // make a request to create an order

  // make a request to cancel the order

  // expectation to make sure the thing is cancelled
});

---`,
    
      ], [
        `# Orders Service Events
Orders Service emits 2 types of Events:
- order:created
- order:cancelled

Order:Created Event
Tickets service 
needs to be told that one of its tickets has been reserved, 
and no further edits to that ticket should be allowed / lockdown ticket !!

Payments service 
needs to know there is a new order 
that a user might submit a payment for 

Expiration service 
needs to start a 15 minute timer to eventually time out this order

Order:Cancelled Event 
- Tickets service 
should unreserve a ticket if the corresponding order has been cancelled 
so this ticket can be edited again 
- Payments Service
should know that any incoming payments for this order should be rejected

Events Creation process :
0 - Add Event name to the Subjects enum in 
1 - Create Event Interface in common/src/events with Subject and Data
2 - then Republish the Common NPM  Module
3 - then Update the Common Module inside the Orders Service
`,`common/src/events/subjects.ts
---
export enum Subjects {
  TicketCreated = "ticket:created",
  TicketUpdated = "ticket:updated",
}

---`,`common/src/events/ticket-created-event.ts
---
import { Subjects } from "./subjects";

export interface TicketCreatedEvent {
  subject: Subjects.TicketCreated;
  data: {
    id: string;
    title: string;
    price: number;
    userId: string;
  };
}

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2074.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2075.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2072.png")`,
    
      ], [
        `# Creating the Events for the Orders Service

- order:created data needs to include
  - for Tickets service :
    - ticket.id
  - for Payments service :
    - user.id
    - ticket.price
  - for Expiration service
    - order.expiresAt
    - order.id

- We'll add also order.status as a provision for future Services

- order:cancelled data needs to include :
  - for Tickets service :
    - ticket.id - to know what ticket to un-reserve
  - for Payments service:
    - order.id

System Design Decision : 
A - Share Maximum info in events
B - Share Minimum info in Events - in our case we share minimum info needed

 because we know exactly what services and how they will use the events

- This is not Future Proof - There might be future servces that might need more data !!!
- in case of changes - the common  library needs to be Redeployed !!!

=> COGITO - might need to go with Max info until stabilized

$ common % npm run pub 
  cd .. && cd orders
$ orders % npm update @w3ai/common  
`,`order-created-event.ts
---
import { Subjects } from "./subjects";
import { OrderStatus } from "./types/order-status";

export interface OrderCreatedEvent {
  subject: Subjects.OrderCreated;
  data: {
    id: string;
    status: OrderStatus;
    userId: string;
    expiresAt: string;
    ticket: {
      id: string;
      price: number;
    };
  };
}

---`,`order-cancelled-event.ts
---
import { Subjects } from "./subjects";

export interface OrderCancelledEvent {
  subject: Subjects.OrderCancelled;
  data: {
    id: string;
    ticket: {
      id: string;
    };
  };
}

---`,`common/src/events/subjects.ts
---
export enum Subjects {
  TicketCreated = "ticket:created",
  TicketUpdated = "ticket:updated",

  OrderCreated = "order:created",
  OrderCancelled = "order:cancelled",
}

---`,`common/src/index.ts
---
// Export errors and middlewares initially in market auth
export * from "./errors/bad-request-error";
export * from "./errors/custom-error";
export * from "./errors/database-connection-error";
export * from "./errors/not-authorized-error";
export * from "./errors/not-found-error";
export * from "./errors/request-validation-error";

export * from "./middlewares/current-user";
export * from "./middlewares/error-handler";
export * from "./middlewares/require-auth";
export * from "./middlewares/validate-request";

export * from "./events/base-listener";
export * from "./events/base-publisher";
export * from "./events/subjects";
export * from "./events/ticket-created-event";
export * from "./events/ticket-updated-event";
export * from "./events/types/order-status";
export * from "./events/order-cancelled-event";
export * from "./events/order-created-event";

---`,
    
      ], [
        `# Implementing Orders Publishers

- 
`,`order-created-publisher.ts
---
import { Publisher, OrderCreatedEvent, Subjects } from "@w3ai/common";

export class OrderCreatedPublisher extends Publisher<
  OrderCreatedEvent
> {
  readonly subject = Subjects.OrderCreated;
}

---`,`order-cancelled-publisher.ts
---
import { Publisher, OrderCancelledEvent, Subjects } from "@w3ai/common";

export class OrderCancelledPublisher extends Publisher<
  OrderCancelledEvent
> {
  readonly subject = Subjects.OrderCancelled;
}


---`,
    
      ], [
        `# Publishing the Order Created Event

- expiresAt - should be shared in a Time Zone agnostic way
  => a UTC timestamp


`,`new.ts
---
    // Publish an event saying that an order was created
    new OrderCreatedPublisher(natsWrapper.client).publish({
      id: order.id,
      status: order.status,
      userId: order.userId,
      expiresAt: order.expiresAt.toISOString(),
      ticket: {
        id: ticket.id,
        price: ticket.price
      }
    })
---`,
    
      ]

    ],
    [
      [
        `# Publishing the Order Cancelled Event

- 
`,`delete.ts
---
    // publish an event saying this order was cancelled!
    new OrderCancelledPublisher(natsWrapper.client).publish({
      id: order.id,
      ticket: {
        id: order.ticket.id,
      },
    });
---`,
    
      ], [
        `# Testing Publishing Order Events

- 
`,`new.test.ts
---
it("emits an order created event", async () => {
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  await request(app)
    .post("/api/orders")
    .set("Cookie", global.signin())
    .send({ ticketId: ticket.id })
    .expect(201);

  expect(natsWrapper.client.publish).toHaveBeenCalled();
});
---`,`delete.test.ts
---
it("emits an order cancelled event", async () => {
  const ticket = Ticket.build({
    title: "service",
    price: 20,
  });
  await ticket.save();

  const user = global.signin();
  // make a request to create an order
  const { body: order } = await request(app)
    .post("/api/orders")
    .set("Cookie", user)
    .send({ ticketId: ticket.id })
    .expect(201);

  // make a request to cancel the order
  await request(app)
    //.delete(\`/api/orders/\${order.id}\`)
    .set("Cookie", user)
    .send()
    .expect(204);

  expect(natsWrapper.client.publish).toHaveBeenCalled();
});

---`,
    
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ]

    ],
    [
      [
        `# Time for Listeners!

- Inside Orders Service we need to build at least 2 listeners: for << to code 1st
  - ticket:created
  - ticket:updated

- Tickets Service needs to listen for :
  - order:created
  - order:cancelled

- Implement a version field in the tickets service !!
`,`
---

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2077.png")`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2076.png")`,
    
      ], [
        `# Listener Creation

- extending the base-listener class from the common library
`,`
---

---`,
    
      ], [
        `# Blueprint for Listeners

- 
`,`orders/src/events/listeners/ticket-created-listener.ts
---
import { Message } from "node-nats-streaming";
import { Subjects, Listener, TicketCreatedEvent } from "@w3ai/common";
import { Ticket } from "../../models/ticket";

export class TicketCreatedListener extends Listener<TicketCreatedEvent> {
  readonly subject = Subjects.TicketCreated;
  queueGroupName = 'orders-service';

  onMessage(data: TicketCreatedEvent['data'], msg: Message) {

  }
}

---`,
    
      ], [
        `# Reminders on queueGroupName, data and msg in Listeners

- Events in a channel will be sent to only one of the queueGroup listeners / service

- To avoid typos, etc on queue group names, we should define then once :

export const queueGroupName = "orders-service";

import { queueGroupName } from "./queue-group-name";

- we call ack(): void; - when we successfully processed a message / event !

- when ack() is not called => msg will be re-distribuited


`,`/@w3ai/common/build/events/ticket-created-event.d.ts
---
import { Subjects } from "./subjects";
export interface TicketCreatedEvent {
    subject: Subjects.TicketCreated;
    data: {
        id: string;
        title: string;
        price: number;
        userId: string;
    };
}

---`,`listeners/queue-group-name.ts
---
export const queueGroupName = "orders-service";
---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2078.png")`,
    
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ]

    ],
    [
      [
        `# onMessage Implementation

- Data replication between services : - saving ticket  inside the Orders db

    const ticket = Ticket.build({
      title,
      price,
    });
    await ticket.save();
`,`ticket-created-listener.ts
---
import { Message } from "node-nats-streaming";
import { Subjects, Listener, TicketCreatedEvent } from "@w3ai/common";
import { Ticket } from "../../models/ticket";
import { queueGroupName } from "./queue-group-name";

export class TicketCreatedListener extends Listener<
  TicketCreatedEvent
> {
  readonly subject = Subjects.TicketCreated;
  queueGroupName = queueGroupName;

  async onMessage(data: TicketCreatedEvent["data"], msg: Message) {
    const { title, price } = data;
    const ticket = Ticket.build({
      title,
      price,
    });
    await ticket.save();

    msg.ack();
  }
}

---`,`=IMAGE("https://storage.googleapis.com/ilabs/screens/screen%2079.png")`,
    
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ]

    ],
    [
      [

      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ]

    ],
    [
      [

      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ]

    ],
    [
      [

      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ]

    ],
    [
      [

      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ], [
        
      ]

    ]
  ]
}